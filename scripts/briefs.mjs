// Match briefings: pull headlines (ESPN + BBC RSS, plus X posts via Apify
// when a token is present), have the model distill a 2-3 sentence pre-match
// brief per upcoming tie, and commit data/briefs.json for the match pages.
//
// Requires ANTHROPIC_API_KEY (repo secret). APIFY_TOKEN is optional — adds
// an X/Twitter sweep per fixture. Exits quietly if the key is missing so the
// workflow never fails while secrets are unset.

import { readFileSync, writeFileSync } from "node:fs";

const SITE = process.env.SITE_URL ?? "https://consensus-football.vercel.app";
const API_KEY = process.env.ANTHROPIC_API_KEY;
const APIFY = process.env.APIFY_TOKEN;
const OUT = new URL("../data/briefs.json", import.meta.url);
const WINDOW_H = 48; // brief matches kicking off within this window

if (!API_KEY) {
  console.log("ANTHROPIC_API_KEY not set - skipping briefs run");
  process.exit(0);
}

const { default: Anthropic } = await import("@anthropic-ai/sdk");
const client = new Anthropic({ apiKey: API_KEY });

// --- gather upcoming ties --------------------------------------------------

const scores = await (await fetch(`${SITE}/api/scores`)).json();
const now = Date.now();
const upcoming = (scores.blend?.matches ?? []).filter((m) => {
  if (m.status !== "scheduled") return false;
  const ko = Date.parse(m.kickoffISO);
  return !Number.isNaN(ko) && ko > now && ko - now < WINDOW_H * 3600e3;
});

if (!upcoming.length) {
  console.log("no upcoming matches in window - nothing to brief");
  process.exit(0);
}

// --- gather sources ----------------------------------------------------------

async function espnNews() {
  try {
    const j = await (
      await fetch(
        "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=25"
      )
    ).json();
    return (j.articles ?? []).map((a) => ({
      headline: a.headline,
      description: a.description ?? "",
      href: a.links?.web?.href ?? "",
      published: a.published,
    }));
  } catch {
    return [];
  }
}

async function bbcNews() {
  try {
    const xml = await (
      await fetch("https://feeds.bbci.co.uk/sport/football/rss.xml")
    ).text();
    const items = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const pick = (tag) =>
        (m[1].match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`)) ??
          [])[1]?.trim() ?? "";
      items.push({
        headline: pick("title"),
        description: pick("description"),
        href: pick("link"),
        published: pick("pubDate"),
      });
    }
    return items.slice(0, 25);
  } catch {
    return [];
  }
}

// Optional: recent X posts per fixture via Apify's tweet scraper.
async function xPosts(homeName, awayName) {
  if (!APIFY) return [];
  try {
    const run = await (
      await fetch(
        `https://api.apify.com/v2/acts/apidojo~tweet-scraper/run-sync-get-dataset-items?token=${APIFY}&timeout=90`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            searchTerms: [`"${homeName}" "${awayName}" world cup`],
            maxItems: 15,
            sort: "Latest",
          }),
        }
      )
    ).json();
    return (Array.isArray(run) ? run : [])
      .map((t) => ({ text: t.text ?? "", likes: t.likeCount ?? 0 }))
      .filter((t) => t.text);
  } catch {
    return [];
  }
}

const [espn, bbc] = await Promise.all([espnNews(), bbcNews()]);
const pool = [...espn, ...bbc].filter((a) => a.headline);

// --- build briefs ------------------------------------------------------------

const key = (m) => [m.homeKey, m.awayKey].sort().join("|");

let existing = { generated: null, briefs: {} };
try {
  existing = JSON.parse(readFileSync(OUT, "utf8"));
} catch {}

const briefs = {};
const dropped = new Set(); // processed but skipped - evict any stale entry
for (const m of upcoming) {
  const names = [m.home.name, m.away.name];
  const relevant = pool.filter((a) => {
    const hay = `${a.headline} ${a.description}`.toLowerCase();
    return names.some((n) => hay.includes(n.toLowerCase()));
  });
  const posts = await xPosts(m.home.name, m.away.name);
  if (!relevant.length && !posts.length) {
    dropped.add(key(m));
    continue;
  }

  const src = relevant
    .slice(0, 8)
    .map((a, i) => `[${i + 1}] ${a.headline} - ${a.description}`)
    .join("\n");
  const social = posts
    .slice(0, 8)
    .map((p) => `- ${p.text.slice(0, 200)}`)
    .join("\n");

  const msg = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 500,
    thinking: { type: "adaptive" },
    system:
      "You write terse pre-match briefings for a football intelligence site. " +
      "2-3 sentences, factual, no hype, no betting language. Only include " +
      "information supported by the sources. Output the briefing text alone - " +
      "never mention the sources, their quality, or these instructions. If the " +
      "sources contain nothing relevant to this match, reply with exactly SKIP.",
    messages: [
      {
        role: "user",
        content:
          `Match: ${m.home.name} v ${m.away.name} (World Cup knockout).\n` +
          `Model advance odds: ${(m.advance.home * 100).toFixed(0)}% - ${(m.advance.away * 100).toFixed(0)}%.\n\n` +
          `Headlines:\n${src || "(none)"}\n\n` +
          (social ? `Recent posts:\n${social}\n\n` : "") +
          "Write the briefing.",
      },
    ],
  });

  const text = msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text || /^SKIP\.?$/i.test(text)) {
    dropped.add(key(m));
    continue;
  }

  briefs[key(m)] = {
    text,
    sources: relevant.slice(0, 3).map((a) => ({ headline: a.headline, href: a.href })),
  };
  console.log(`briefed ${key(m)}`);
}

for (const k of dropped) delete existing.briefs[k];

if (!Object.keys(briefs).length && !dropped.size) {
  console.log("no briefs produced - keeping existing file");
  process.exit(0);
}

writeFileSync(
  OUT,
  JSON.stringify(
    { generated: new Date().toISOString(), briefs: { ...existing.briefs, ...briefs } },
    null,
    2
  ) + "\n"
);
console.log(`wrote ${Object.keys(briefs).length} brief(s), evicted ${dropped.size}`);
