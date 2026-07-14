// Pull the next ~8 weeks of UFC cards from ESPN's scoreboard into data/upcoming.json.
// Always a full overwrite — fight cards churn constantly (injuries, replacements), so
// pairings must never be cached across runs.
//
// Usage: node scripts/scrape-upcoming.mjs

import { writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../../data/ufc/upcoming.json", import.meta.url);
const BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const WEEKS_AHEAD = 8;

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");

// Future-event competitors carry the athlete id on the competitor, not the inlined athlete.
const fighter = (x) => ({
  id: x?.athlete?.id ?? x?.id ?? null,
  name: x?.athlete?.displayName ?? null,
  flag: x?.athlete?.flag?.href ?? null,
  record: x?.records?.find((r) => r.type === "total")?.summary ?? x?.records?.[0]?.summary ?? null,
});

// Card segments (Main Card / Prelims / Early Prelims) + bout order live only in the core API.
async function fetchSegments(eventId) {
  const url = `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${eventId}?lang=en&region=us`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const byBout = {};
      for (const c of d.competitions ?? []) {
        byBout[c.id] = {
          segment: c.cardSegment?.description ?? null,
          matchNumber: c.matchNumber ?? null,
        };
      }
      return byBout;
    } catch (err) {
      if (attempt === 3) {
        console.warn(`  segments ${eventId}: ${err.message}`);
        return {};
      }
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

async function main() {
  const now = new Date();
  const to = new Date(now.getTime() + WEEKS_AHEAD * 7 * 864e5);
  const res = await fetch(`${BASE}?dates=${ymd(now)}-${ymd(to)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const events = (await res.json()).events ?? [];

  const cards = [];
  for (const ev of events) {
    const segments = await fetchSegments(ev.id);
    cards.push({
      eventId: ev.id,
      name: ev.name,
      shortName: ev.shortName,
      date: ev.date,
      venue: ev.competitions?.[0]?.venue?.fullName ?? null,
      fights: (ev.competitions ?? [])
        .filter((c) => c.status?.type?.state !== "post")
        .map((c) => ({
          boutId: c.id,
          date: c.date,
          weightClass: c.type?.abbreviation ?? null,
          segment: segments[c.id]?.segment ?? null,
          matchNumber: segments[c.id]?.matchNumber ?? null,
          a: fighter(c.competitors?.[0]),
          b: fighter(c.competitors?.[1]),
        })),
    });
  }

  mkdirSync(new URL("../../data/ufc/", import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ fetchedAt: now.toISOString(), cards }, null, 1));
  console.log(`wrote ${cards.length} upcoming cards (${cards.reduce((s, c) => s + c.fights.length, 0)} fights)`);
  for (const c of cards) console.log(`  ${c.date.slice(0, 10)}  ${c.name}  (${c.fights.length} fights)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
