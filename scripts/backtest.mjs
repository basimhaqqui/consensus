// Backtest the forecasting link against history. Replays the same Elo engine
// as compute-ratings.mjs chronologically; every match from EVAL_START onward
// is predicted (W/D/L) using only ratings available before kickoff, scored,
// and then fed back into the ratings. No leakage.
//
// Compares the production link (supremacy = diff/90, BASE 1.35, cap 2.2)
// against a grid of (divisor, BASE) candidates and reports log loss, Brier,
// and calibration. Also slices WC 2018 / WC 2022 / Euro 2024.
//
// Run: node scripts/backtest.mjs

const CSV =
  "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

const EVAL_START = "2015-01-01";
const MIN_MATCHES = 20; // both teams need this many prior games to count

// --- Elo engine (identical to compute-ratings.mjs) -------------------------

function weight(tournament) {
  const t = tournament.toLowerCase();
  if (t.includes("world cup") && !t.includes("qual")) return 60;
  if (/(copa am|euro|african cup|asian cup|gold cup|confederations)/.test(t))
    return 50;
  if (t.includes("qual") || t.includes("nations league")) return 40;
  if (t.includes("friendly")) return 20;
  return 30;
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  lines.shift();
  return lines.map((l) => {
    const [date, home, away, hs, as, tournament, , , neutral] = l.split(",");
    return { date, home, away, hs, as, tournament, neutral };
  });
}

// --- forecast link (mirrors lib/model.ts) -----------------------------------

function poisson(k, lambda) {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

// Dixon-Coles low-score adjustment: negative rho inflates 0-0 / 1-1 and
// deflates 1-0 / 0-1, fixing the draw shortfall of independent Poissons.
function tau(h, a, lh, la, rho) {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

// W/D/L from a rating diff under a given link parameterisation
function forecastDiff(diff, { div, base, cap, rho = 0 }) {
  const supremacy = Math.max(-cap, Math.min(cap, diff / div));
  const lh = Math.max(0.25, base + supremacy / 2);
  const la = Math.max(0.25, base - supremacy / 2);
  let pH = 0,
    pD = 0,
    pA = 0;
  for (let h = 0; h <= 8; h++) {
    for (let a = 0; a <= 8; a++) {
      const p = poisson(h, lh) * poisson(a, la) * tau(h, a, lh, la, rho);
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }
  const t = pH + pD + pA;
  return [pH / t, pD / t, pA / t];
}

// --- scoring ----------------------------------------------------------------

function makeScore() {
  return { n: 0, logloss: 0, brier: 0 };
}
function addScore(s, probs, outcome) {
  // outcome: 0 home win, 1 draw, 2 away win
  const p = Math.max(1e-12, probs[outcome]);
  s.logloss += -Math.log(p);
  let b = 0;
  for (let i = 0; i < 3; i++) b += (probs[i] - (outcome === i ? 1 : 0)) ** 2;
  s.brier += b;
  s.n++;
}
const fmtScore = (s) =>
  `n=${s.n}  logloss=${(s.logloss / s.n).toFixed(4)}  brier=${(s.brier / s.n).toFixed(4)}`;

// --- main -------------------------------------------------------------------

const res = await fetch(CSV);
const matches = parseCSV(await res.text());

const PRODUCTION = { div: 210, base: 1.25, cap: 3.0, rho: 0 }; // shipped link
const CANDIDATE = { div: 210, base: 1.35, cap: 3.0, rho: -0.1 }; // grid winner
const calibBest = [];
const grid = [];
for (const div of [190, 210, 230])
  for (const base of [1.15, 1.25, 1.35])
    for (const rho of [-0.15, -0.1, -0.05, 0])
      grid.push({ div, base, cap: 3.0, rho });

// slices we report separately
const slices = {
  "WC 2018": (m) =>
    m.date.startsWith("2018") && /^fifa world cup$/i.test(m.tournament),
  "WC 2022": (m) =>
    m.date.startsWith("2022") && /^fifa world cup$/i.test(m.tournament),
  "Euro 2024": (m) =>
    m.date.startsWith("2024") && /^uefa euro$/i.test(m.tournament),
};

const ratings = new Map();
const played = new Map();
const get = (t) => ratings.get(t) ?? 1500;

// scores: per-model overall + per-slice for production and (later) best
const overall = new Map(); // model key -> score
const key = (m) => `div${m.div}/base${m.base}/rho${m.rho}`;
overall.set("production", makeScore());
grid.forEach((g) => overall.set(key(g), makeScore()));
const sliceScores = {}; // slice -> {production, candidates: Map}
for (const s of Object.keys(slices)) {
  sliceScores[s] = { production: makeScore(), cand: new Map() };
  grid.forEach((g) => sliceScores[s].cand.set(key(g), makeScore()));
}

// calibration buckets (favourite's predicted win prob -> did favourite win)
const calib = { production: [], best: null }; // filled for production now

let capBinds = 0;
let evaluated = 0;

for (const m of matches) {
  if (m.hs === "NA" || m.as === "NA" || m.hs === "" || m.as === undefined)
    continue;
  const hs = Number(m.hs);
  const as = Number(m.as);
  if (Number.isNaN(hs) || Number.isNaN(as)) continue;

  const neutral = m.neutral === "TRUE";
  const hfa = neutral ? 0 : 100;
  const Ra = get(m.home);
  const Rb = get(m.away);

  // predict + score before updating
  if (
    m.date >= EVAL_START &&
    (played.get(m.home) ?? 0) >= MIN_MATCHES &&
    (played.get(m.away) ?? 0) >= MIN_MATCHES
  ) {
    const diff = Ra + hfa - Rb;
    const outcome = hs > as ? 0 : hs === as ? 1 : 2;
    evaluated++;
    if (Math.abs(diff / PRODUCTION.div) > PRODUCTION.cap) capBinds++;

    const pProd = forecastDiff(diff, PRODUCTION);
    addScore(overall.get("production"), pProd, outcome);
    const favP = Math.max(pProd[0], pProd[2]);
    calib.production.push([favP, (favP === pProd[0] ? 0 : 2) === outcome]);
    const pBest = forecastDiff(diff, CANDIDATE);
    const favB = Math.max(pBest[0], pBest[2]);
    calibBest.push([favB, (favB === pBest[0] ? 0 : 2) === outcome]);

    for (const g of grid) {
      const p = forecastDiff(diff, g);
      addScore(overall.get(key(g)), p, outcome);
      for (const [name, match] of Object.entries(slices)) {
        if (match(m)) addScore(sliceScores[name].cand.get(key(g)), p, outcome);
      }
    }
    for (const [name, match] of Object.entries(slices)) {
      if (match(m)) addScore(sliceScores[name].production, pProd, outcome);
    }
  }

  // Elo update (same maths as compute-ratings.mjs)
  const dr = Ra + hfa - Rb;
  const We = 1 / (1 + Math.pow(10, -dr / 400));
  const W = hs > as ? 1 : hs === as ? 0.5 : 0;
  const gd = Math.abs(hs - as);
  const G = gd <= 1 ? 1 : gd === 2 ? 1.5 : (11 + gd) / 8;
  const K = weight(m.tournament);
  const delta = K * G * (W - We);
  ratings.set(m.home, Ra + delta);
  ratings.set(m.away, Rb - delta);
  played.set(m.home, (played.get(m.home) ?? 0) + 1);
  played.set(m.away, (played.get(m.away) ?? 0) + 1);
}

// --- report -----------------------------------------------------------------

console.log(`evaluated ${evaluated} matches since ${EVAL_START} (both teams ≥${MIN_MATCHES} games)`);
console.log(`production cap (±2.2 @ div 90) binds on ${((capBinds / evaluated) * 100).toFixed(1)}% of matches\n`);

const rows = [["production", overall.get("production")]];
for (const g of grid) rows.push([key(g), overall.get(key(g))]);
rows.sort((a, b) => a[1].logloss / a[1].n - b[1].logloss / b[1].n);

console.log("=== OVERALL (sorted by log loss) ===");
for (const [name, s] of rows.slice(0, 10)) console.log(name.padEnd(18), fmtScore(s));
const prodRank = rows.findIndex(([n]) => n === "production") + 1;
if (prodRank > 10)
  console.log(`...\nproduction ranks #${prodRank}/${rows.length}:`, fmtScore(overall.get("production")));

const best = rows[0][0] === "production" ? rows[1][0] : rows[0][0];
console.log("\n=== TOURNAMENT SLICES (production vs best) ===");
for (const name of Object.keys(slices)) {
  console.log(`${name}:`);
  console.log("  production ".padEnd(18), fmtScore(sliceScores[name].production));
  console.log(`  ${best} `.padEnd(18), fmtScore(sliceScores[name].cand.get(best)));
}

function printCalib(title, pairs) {
  console.log(`\n=== CALIBRATION (${title}): favourite win prob vs reality ===`);
  const buckets = new Map();
  for (const [p, won] of pairs) {
    const b = Math.min(90, Math.floor(p * 10) * 10);
    const cur = buckets.get(b) ?? { n: 0, won: 0, sum: 0 };
    cur.n++;
    if (won) cur.won++;
    cur.sum += p;
    buckets.set(b, cur);
  }
  for (const b of [...buckets.keys()].sort((a, c) => a - c)) {
    const { n, won, sum } = buckets.get(b);
    console.log(
      `  predicted ~${(sum / n * 100).toFixed(0)}%  actual ${((won / n) * 100).toFixed(1)}%  (n=${n})`
    );
  }
}
printCalib("production", calib.production);
printCalib(`candidate div${CANDIDATE.div}/base${CANDIDATE.base}`, calibBest);
