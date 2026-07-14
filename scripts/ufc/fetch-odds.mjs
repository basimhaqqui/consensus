// Pull MMA h2h odds from The Odds API, de-vig each book, average across books, and match
// to our upcoming fights by fighter-name pair → data/odds.json (keyed by boutId).
// Costs 1 credit per run (single region, single market). Needs ODDS_API_KEY.
//
// Usage: node scripts/fetch-odds.mjs

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.ODDS_API_KEY;
if (!KEY) {
  // Local convenience: read .env.local the way the app does.
  try {
    const env = readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
    const m = env.match(/^ODDS_API_KEY=(.+)$/m);
    if (m) process.env.ODDS_API_KEY = m[1].trim();
  } catch {}
}
const key = process.env.ODDS_API_KEY;
if (!key) {
  console.error("ODDS_API_KEY not set");
  process.exit(1);
}

const norm = (s) =>
  (s ?? "")
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

async function main() {
  const upcoming = JSON.parse(readFileSync(new URL("../../data/ufc/upcoming.json", import.meta.url), "utf8"));

  const url = `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${key}&regions=us&markets=h2h,totals&oddsFormat=decimal`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`odds api HTTP ${res.status}`);
  console.log(`credits remaining: ${res.headers.get("x-requests-remaining")}`);
  const events = await res.json();

  // index market events by unordered name pair; also by first-initial+surname to survive
  // nickname drift between sources ("Zachary Reese" vs "Zach Reese", "Benoît" vs "Benoit")
  const initSur = (s) => {
    const w = (s ?? "").replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "").split(" ").filter(Boolean);
    return w.length < 2 ? norm(s) : norm(w[0]).slice(0, 1) + norm(w.slice(1).join(" "));
  };
  const byPair = new Map();
  const byLoosePair = new Map();
  for (const e of events) {
    byPair.set([norm(e.home_team), norm(e.away_team)].sort().join("|"), e);
    byLoosePair.set([initSur(e.home_team), initSur(e.away_team)].sort().join("|"), e);
  }

  const byBout = {};
  let matched = 0;
  let total = 0;
  for (const card of upcoming.cards) {
    for (const f of card.fights) {
      total++;
      const e =
        byPair.get([norm(f.a.name), norm(f.b.name)].sort().join("|")) ??
        byLoosePair.get([initSur(f.a.name), initSur(f.b.name)].sort().join("|"));
      if (!e) continue;

      // de-vig each book's h2h for fighter A, then average across books; also keep the
      // average PAYABLE price per side and rounds-totals prices — the bankroll simulation
      // bets at real prices, not de-vigged ones.
      const probsA = [];
      const pricesA = [];
      const pricesB = [];
      const totals = new Map(); // point -> {over:[], under:[]}
      for (const bk of e.bookmakers) {
        const mkt = bk.markets.find((m) => m.key === "h2h");
        if (mkt && mkt.outcomes.length === 2) {
          const oA =
            mkt.outcomes.find((o) => norm(o.name) === norm(f.a.name)) ??
            mkt.outcomes.find((o) => initSur(o.name) === initSur(f.a.name));
          const oB =
            mkt.outcomes.find((o) => norm(o.name) === norm(f.b.name)) ??
            mkt.outcomes.find((o) => initSur(o.name) === initSur(f.b.name));
          if (oA && oB && oA.price > 1 && oB.price > 1) {
            const [ia, ib] = [1 / oA.price, 1 / oB.price];
            probsA.push(ia / (ia + ib));
            pricesA.push(oA.price);
            pricesB.push(oB.price);
          }
        }
        const tot = bk.markets.find((m) => m.key === "totals");
        if (tot) {
          for (const o of tot.outcomes ?? []) {
            if (typeof o.point !== "number" || o.price <= 1) continue;
            if (!totals.has(o.point)) totals.set(o.point, { over: [], under: [] });
            totals.get(o.point)[o.name === "Over" ? "over" : "under"].push(o.price);
          }
        }
      }
      if (!probsA.length) continue;
      matched++;
      const avg = (xs) => Math.round((xs.reduce((s, x) => s + x, 0) / xs.length) * 100) / 100;
      byBout[f.boutId] = {
        pA: Math.round((probsA.reduce((s, x) => s + x, 0) / probsA.length) * 1000) / 1000,
        books: probsA.length,
        commence: e.commence_time,
        priceA: avg(pricesA),
        priceB: avg(pricesB),
        totals: [...totals.entries()]
          .filter(([, v]) => v.over.length && v.under.length)
          .map(([point, v]) => ({ point, over: avg(v.over), under: avg(v.under), books: v.over.length })),
      };
    }
  }

  writeFileSync(
    new URL("../../data/ufc/odds.json", import.meta.url),
    JSON.stringify({ fetchedAt: new Date().toISOString(), byBout }, null, 1)
  );

  // Append-only line history (30-day window) — the raw material for movement arrows
  // and closing-line analysis. Can't be backfilled, so every run records a snapshot.
  const HIST = new URL("../../data/ufc/odds-history.json", import.meta.url);
  let hist = { snapshots: [] };
  try {
    hist = JSON.parse(readFileSync(HIST, "utf8"));
  } catch {}
  const cutoff = Date.now() - 30 * 864e5;
  hist.snapshots = hist.snapshots.filter((s) => new Date(s.at).getTime() > cutoff);
  hist.snapshots.push({
    at: new Date().toISOString(),
    lines: Object.fromEntries(Object.entries(byBout).map(([k, v]) => [k, v.pA])),
  });
  writeFileSync(HIST, JSON.stringify(hist, null, 1));

  console.log(`matched ${matched}/${total} upcoming fights to book lines (${hist.snapshots.length} snapshots in history)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
