// Prediction ledger. Snapshots the site's own pre-match forecasts shortly
// before kickoff and grades them once results land — an append-only,
// git-committed record, so the track record is auditable in commit history.
//
// Capture: any scheduled knockout match kicking off within the next window
// gets one entry with the advance probability from each rating view (and
// the live sportsbook number when available).
// Grade: entries whose match has since finished get the winner attached.
//
// Run: SITE_URL=https://<deployment> node scripts/ledger.mjs
// (defaults to http://localhost:3000 for local testing)

import { readFileSync, writeFileSync } from "node:fs";

const SITE = process.env.SITE_URL ?? "http://localhost:3000";
const WINDOW_H = Number(process.env.WINDOW_H ?? 3); // capture window, hours before kickoff
const FILE = new URL("../data/ledger.json", import.meta.url);

const res = await fetch(`${SITE}/api/scores`, {
  headers: { "User-Agent": "wc26-ledger" },
});
if (!res.ok) {
  console.error(`feed ${res.status} from ${SITE}`);
  process.exit(1);
}
const boards = await res.json();

const byId = (board) => new Map(board.matches.map((m) => [m.id, m]));
const model = byId(boards.model);
const blend = byId(boards.blend);

const ledger = JSON.parse(readFileSync(FILE, "utf8"));
const have = new Set(ledger.entries.map((e) => e.id));
const now = Date.now();
let captured = 0;
let graded = 0;

// capture forecasts for imminent matches
for (const [id, m] of model) {
  if (m.status !== "scheduled" || have.has(id)) continue;
  const ko = Date.parse(m.kickoffISO);
  if (!Number.isFinite(ko)) continue;
  const hoursOut = (ko - now) / 36e5;
  if (hoursOut < 0 || hoursOut > WINDOW_H) continue;

  ledger.entries.push({
    id,
    kickoffISO: m.kickoffISO,
    home: m.homeKey,
    away: m.awayKey,
    venue: m.venue,
    // advance probability of the HOME side under each view
    forecasts: {
      model: +m.advance.home.toFixed(4),
      blend: +(blend.get(id)?.advance.home ?? m.advance.home).toFixed(4),
      market: m.market ? +m.market.advHome.toFixed(4) : null,
    },
    capturedAt: new Date().toISOString(),
  });
  captured++;
}

// grade finished matches
for (const e of ledger.entries) {
  if (e.result) continue;
  const m = model.get(e.id);
  if (!m || m.status !== "final" || !m.winnerKey) continue;
  e.result = {
    winnerKey: m.winnerKey,
    score: m.score ?? null,
    detail: m.live?.detail ?? "FT",
    gradedAt: new Date().toISOString(),
  };
  graded++;
}

if (captured || graded) {
  ledger.entries.sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  writeFileSync(FILE, JSON.stringify(ledger, null, 2) + "\n");
}
console.log(
  `ledger: +${captured} captured, +${graded} graded, ${ledger.entries.length} total`
);
