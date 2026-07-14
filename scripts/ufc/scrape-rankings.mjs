// Official UFC rankings from ufc.com/rankings → data/ufc-rankings.json.
// (ESPN's rankings endpoint is abandoned — years stale — so we go to the source.)
// Names are matched to our fighter ids so the UI can link faces and show our Elo
// next to the official ranks.
//
// Usage: node scripts/scrape-rankings.mjs

import { readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../../data/ufc/ufc-rankings.json", import.meta.url);

const norm = (s) =>
  (s ?? "")
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[łŁ]/g, "l")
    .replace(/[øØ]/g, "o")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

async function main() {
  const res = await fetch("https://www.ufc.com/rankings", {
    headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
  });
  if (!res.ok) throw new Error(`ufc.com HTTP ${res.status}`);
  const html = await res.text();

  // name -> our fighter id (from ratings; loose fallback on initial+surname)
  let byName = new Map();
  let byLoose = new Map();
  try {
    const ratings = JSON.parse(readFileSync(new URL("../../data/ufc/ratings.json", import.meta.url), "utf8")).ratings;
    for (const [id, r] of Object.entries(ratings)) {
      if (!r.name) continue;
      byName.set(norm(r.name), id);
      const w = r.name.split(" ").filter(Boolean);
      if (w.length >= 2) byLoose.set(norm(w[0]).slice(0, 1) + norm(w.slice(1).join(" ")), id);
    }
  } catch {}
  const idOf = (name) => {
    const w = (name ?? "").split(" ").filter(Boolean);
    return (
      byName.get(norm(name)) ??
      (w.length >= 2 ? byLoose.get(norm(w[0]).slice(0, 1) + norm(w.slice(1).join(" "))) : null) ??
      // nickname-in-the-middle ("Michael Venom Page"): first initial + last word only
      (w.length >= 3 ? byLoose.get(norm(w[0]).slice(0, 1) + norm(w[w.length - 1])) : null) ??
      null
    );
  };

  const divisions = [];
  const blocks = html.split('class="view-grouping"');
  for (const block of blocks.slice(1)) {
    const header = block.match(/view-grouping-header">([^<]+)(?:<span>([^<]*)<\/span>)?/);
    if (!header) continue;
    const name = header[1].trim().replace(/\s+$/, "");
    const champM = block.match(/rankings--athlete--champion[\s\S]{0,600}?<h5><a href="\/athlete\/[^"]+"[^>]*>([^<]+)<\/a>/);
    const champion = champM ? champM[1].trim() : null;
    const rows = [...block.matchAll(
      /views-field-weight-class-rank">\s*(\d+)\s*<\/td>\s*<td class="views-field views-field-title"><a href="\/athlete\/[^"]+"[^>]*>([^<]+)<\/a>/g
    )].map((m) => ({ rank: Number(m[1]), name: m[2].trim(), id: idOf(m[2].trim()) }));
    if (!rows.length) continue;
    const isP4P = /pound-for-pound/i.test(name);
    divisions.push({
      name,
      p4p: isP4P,
      champion: isP4P || !champion ? null : { name: champion, id: idOf(champion) },
      ranks: rows,
    });
  }

  if (divisions.length < 8) throw new Error(`only parsed ${divisions.length} divisions — page layout changed?`);
  writeFileSync(OUT, JSON.stringify({ updatedAt: new Date().toISOString(), divisions }, null, 1));
  const unmatched = divisions.flatMap((d) => d.ranks.filter((r) => !r.id).map((r) => r.name));
  console.log(`wrote ${divisions.length} divisions; unmatched names: ${unmatched.length}${unmatched.length ? " (" + unmatched.slice(0, 5).join(", ") + "…)" : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
