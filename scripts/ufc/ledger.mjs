// The public prediction ledger. Two jobs per run:
//   1. CAPTURE — any upcoming fight starting within WINDOW_H hours gets its model forecast
//      (and the books' de-vigged line, if posted) frozen into data/ledger.json. One entry
//      per bout, ever — entries are never edited after capture.
//   2. GRADE — captured entries whose result has landed in data/fights.json get the outcome
//      plus log loss for model and books. Log loss vs books is THE metric.
//
// Usage: node scripts/ledger.mjs

import { readFileSync, writeFileSync } from "node:fs";

const WINDOW_H = 12;
const LEDGER = new URL("../../data/ufc/ledger.json", import.meta.url);

const read = (p) => JSON.parse(readFileSync(new URL(`../../data/ufc/${p}`, import.meta.url), "utf8"));

const forecasts = read("forecasts.json");
const fights = read("fights.json");
let odds = { byBout: {} };
try {
  odds = read("odds.json");
} catch {}
let ledger = { entries: [] };
try {
  ledger = JSON.parse(readFileSync(LEDGER, "utf8"));
} catch {}

const now = Date.now();
const have = new Set(ledger.entries.map((e) => e.boutId));

// capture
let captured = 0;
for (const card of forecasts.cards) {
  for (const f of card.fights) {
    if (have.has(f.boutId)) continue;
    const start = new Date(f.date).getTime();
    if (start < now || start > now + WINDOW_H * 3600e3) continue;
    if (!f.a.id || !f.b.id) continue;
    const book = odds.byBout[f.boutId];
    ledger.entries.push({
      boutId: f.boutId,
      event: card.name,
      date: f.date,
      weightClass: f.weightClass,
      a: f.a,
      b: f.b,
      model_pA: f.pA,
      books_pA: book?.pA ?? null,
      books: book?.books ?? 0,
      capturedAt: new Date().toISOString(),
    });
    have.add(f.boutId);
    captured++;
  }
}

// grade
const results = new Map(fights.map((x) => [x.boutId, x]));
const ll = (p, won) => -Math.log(Math.min(1 - 1e-9, Math.max(1e-9, won ? p : 1 - p)));
let graded = 0;
for (const e of ledger.entries) {
  if (e.result) continue;
  const r = results.get(e.boutId);
  if (!r) continue;
  if (r.winnerId === null) {
    e.result = { noContest: true, gradedAt: new Date().toISOString() };
    graded++;
    continue;
  }
  const aWon = r.winnerId === e.a.id;
  e.result = {
    aWon,
    round: r.round,
    decision: r.decision,
    gradedAt: new Date().toISOString(),
    llModel: Math.round(ll(e.model_pA, aWon) * 10000) / 10000,
    llBooks: e.books_pA !== null ? Math.round(ll(e.books_pA, aWon) * 10000) / 10000 : null,
  };
  graded++;
}

ledger.entries.sort((x, y) => x.date.localeCompare(y.date));
writeFileSync(LEDGER, JSON.stringify(ledger, null, 1));

const done = ledger.entries.filter((e) => e.result && !e.result.noContest);
const withBooks = done.filter((e) => e.result.llBooks !== null);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);
console.log(`captured ${captured}, graded ${graded} | ledger: ${ledger.entries.length} entries, ${done.length} graded`);
if (withBooks.length) {
  console.log(
    `log loss — model ${avg(withBooks.map((e) => e.result.llModel)).toFixed(4)} vs books ${avg(withBooks.map((e) => e.result.llBooks)).toFixed(4)} (n=${withBooks.length})`
  );
}
