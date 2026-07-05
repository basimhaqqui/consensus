// Refresh market ratings from LIVE title-outright odds (The Odds API,
// soccer_fifa_world_cup_winner). The hand-set marketRating values in data.ts
// were calibrated to pre-tournament odds and go stale as the bracket runs;
// this recalibrates surviving teams to today's market.
//
// Method: de-vig + book-average the outright prices into title probabilities,
// then fit rating = a + b*ln(champ%) on the MODEL's own (rating, simulated
// champ%) pairs and evaluate that line at each team's market probability.
// Both probabilities embed the same bracket, so the mapping stays comparable.
//
// Runs in the ledger cron; skips when the file is <48h fresh (quota is
// nearly spent this cycle) or when ODDS_API_KEY is unset.

import { readFileSync, writeFileSync } from "node:fs";

const KEY = process.env.ODDS_API_KEY;
const SITE = process.env.SITE_URL ?? "https://consensus-football.vercel.app";
const OUT = new URL("../data/market-ratings.json", import.meta.url);
const FRESH_H = 48;

if (!KEY) {
  console.log("ODDS_API_KEY not set - skipping market ratings");
  process.exit(0);
}

let existing = { generated: null, ratings: {} };
try {
  existing = JSON.parse(readFileSync(OUT, "utf8"));
} catch {}
if (
  existing.generated &&
  Date.now() - Date.parse(existing.generated) < FRESH_H * 3600e3
) {
  console.log("market ratings fresh - skipping");
  process.exit(0);
}

const NAME_TO_KEY = {
  France: "FRA", Argentina: "ARG", Spain: "ESP", England: "ENG",
  Brazil: "BRA", Portugal: "POR", Germany: "GER", Netherlands: "NED",
  Belgium: "BEL", Croatia: "CRO", Morocco: "MAR", Colombia: "COL",
  Norway: "NOR", Senegal: "SEN", Switzerland: "SUI", Japan: "JPN",
  Mexico: "MEX", USA: "USA", "United States": "USA", Ecuador: "ECU",
  Sweden: "SWE", Austria: "AUT", "Ivory Coast": "IVO", Canada: "CAN",
  Algeria: "ALG", Ghana: "GHA", Egypt: "EGY", Australia: "AUS",
  "Bosnia and Herzegovina": "BIH", "DR Congo": "COD", Paraguay: "PAR",
  "South Africa": "RSA", "Cape Verde": "CPV",
};

// --- market title probabilities ---------------------------------------------

const url =
  `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds` +
  `?apiKey=${KEY}&regions=us&markets=outrights&oddsFormat=decimal`;
const res = await fetch(url);
if (!res.ok) {
  console.log(`outrights fetch failed (${res.status}) - keeping existing`);
  process.exit(0);
}
console.log(`odds credits remaining: ${res.headers.get("x-requests-remaining")}`);
const events = await res.json();

// per book: de-vig the outright sheet, then average probabilities per team
const sums = new Map(); // key -> {p, n}
for (const ev of events) {
  for (const bm of ev.bookmakers ?? []) {
    const outcomes = bm.markets?.find((m) => m.key === "outrights")?.outcomes;
    if (!outcomes || outcomes.length < 2) continue;
    const inv = outcomes.map((o) => 1 / o.price);
    const vig = inv.reduce((a, b) => a + b, 0);
    outcomes.forEach((o, i) => {
      const k = NAME_TO_KEY[o.name];
      if (!k) return;
      const cur = sums.get(k) ?? { p: 0, n: 0 };
      cur.p += inv[i] / vig;
      cur.n += 1;
      sums.set(k, cur);
    });
  }
}
const market = new Map(
  [...sums].map(([k, { p, n }]) => [k, p / n]).filter(([, p]) => p > 0.0005)
);
if (market.size < 3) {
  console.log(`only ${market.size} teams priced - keeping existing`);
  process.exit(0);
}

// --- fit the model's rating <-> champ% line ----------------------------------

const scores = await (await fetch(`${SITE}/api/scores`)).json();
const sim = scores.model?.sim ?? [];
const ratingsTs = readFileSync(
  new URL("../lib/derivedRatings.ts", import.meta.url),
  "utf8"
);
const DERIVED = JSON.parse(
  ratingsTs.match(/DERIVED_RATINGS: Record<string, number> = (\{[\s\S]*?\});/)[1]
);

const pts = sim
  .filter((r) => r.champ > 0.001 && DERIVED[r.key] !== undefined)
  .map((r) => ({ x: Math.log(r.champ), y: DERIVED[r.key] }));
if (pts.length < 3) {
  console.log("too few model points to fit - keeping existing");
  process.exit(0);
}
const n = pts.length;
const mx = pts.reduce((a, p) => a + p.x, 0) / n;
const my = pts.reduce((a, p) => a + p.y, 0) / n;
const b =
  pts.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0) /
  pts.reduce((a, p) => a + (p.x - mx) ** 2, 0);
const a = my - b * mx;
if (!(b > 10 && b < 400)) {
  console.log(`fit slope ${b.toFixed(1)} out of range - keeping existing`);
  process.exit(0);
}

// --- evaluate at market probabilities ---------------------------------------

const ratings = {};
for (const [k, p] of market) {
  ratings[k] = Math.round(
    Math.max(1600, Math.min(2300, a + b * Math.log(p)))
  );
}

writeFileSync(
  OUT,
  JSON.stringify({ generated: new Date().toISOString(), ratings }, null, 2) + "\n"
);
console.log(
  `wrote ${Object.keys(ratings).length} market ratings (a=${a.toFixed(0)}, b=${b.toFixed(0)}):`,
  Object.entries(ratings)
    .sort((x, y) => y[1] - x[1])
    .map(([k, r]) => `${k} ${r}`)
    .join("  ")
);
