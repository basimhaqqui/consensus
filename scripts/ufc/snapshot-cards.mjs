// Append-only log of fight-card pairings → data/card-log.json. Each run records any bout
// whose pairing is new or changed (injury replacements, cancellations show up as new rows).
// This builds the dataset for a future short-notice-replacement feature — a fighter whose
// pairing first appeared days before the fight took it on short notice.
//
// Usage: node scripts/snapshot-cards.mjs

import { readFileSync, writeFileSync } from "node:fs";

const upcoming = JSON.parse(readFileSync(new URL("../../data/ufc/upcoming.json", import.meta.url), "utf8"));
const OUT = new URL("../../data/ufc/card-log.json", import.meta.url);
let log = {};
try {
  log = JSON.parse(readFileSync(OUT, "utf8"));
} catch {}

let changes = 0;
for (const card of upcoming.cards) {
  for (const f of card.fights) {
    const pairing = [f.a.id, f.b.id].map(String).sort().join("|");
    const rows = (log[f.boutId] ??= []);
    if (rows.at(-1)?.pairing !== pairing) {
      rows.push({ pairing, seen: new Date().toISOString().slice(0, 10), fightDate: f.date });
      changes++;
    }
  }
}

writeFileSync(OUT, JSON.stringify(log, null, 1));
console.log(`card log: ${changes} new/changed pairings, ${Object.keys(log).length} bouts tracked`);
