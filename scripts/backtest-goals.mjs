// Backtest the GOALS model (xG line + likely score), not just W/D/L.
// Same online Elo replay as backtest.mjs; every match from EVAL_START is
// scored on the joint scoreline likelihood, exact-scoreline hit rate, and
// total-goals calibration, comparing the shipped additive link against
// log-link (multiplicative) candidates where supremacy scales goals.
//
// Run: node scripts/backtest-goals.mjs

const CSV =
  "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

const EVAL_START = "2015-01-01";
const MIN_MATCHES = 20;
const MAX_G = 8;

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

// --- goal models ------------------------------------------------------------

function poisson(k, lambda) {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

function tau(h, a, lh, la, rho) {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

// additive: the old shipped link. log: multiplicative, supremacy scales
// rates. style: log link plus per-team attack/concede residuals.
function lambdas(m, diff, homeTeam, awayTeam) {
  if (m.kind === "add") {
    const s = Math.max(-m.cap, Math.min(m.cap, diff / m.div));
    return {
      lh: Math.max(0.25, m.base + s / 2),
      la: Math.max(0.25, m.base - s / 2),
    };
  }
  const s = Math.max(-3, Math.min(3, diff / m.div));
  if (m.kind === "style") {
    const g = (map, t) => map.get(t) ?? 0;
    return {
      lh: Math.exp(m.mu + s / 2 + g(m.att, homeTeam) + g(m.con, awayTeam)),
      la: Math.exp(m.mu - s / 2 + g(m.att, awayTeam) + g(m.con, homeTeam)),
    };
  }
  return { lh: Math.exp(m.mu + s / 2), la: Math.exp(m.mu - s / 2) };
}

// online SGD on the Poisson log-likelihood, with a light pull toward zero so
// old form fades; clamped to keep any team inside a sane style band
function styleUpdate(m, homeTeam, awayTeam, diff, hs, as) {
  if (m.kind !== "style") return;
  const { lh, la } = lambdas(m, diff, homeTeam, awayTeam);
  const clamp = (v) => Math.max(-0.35, Math.min(0.35, v));
  const upd = (map, t, grad) =>
    map.set(t, clamp(((map.get(t) ?? 0) * 0.995) + m.eta * grad));
  upd(m.att, homeTeam, hs - lh);
  upd(m.con, awayTeam, hs - lh);
  upd(m.att, awayTeam, as - la);
  upd(m.con, homeTeam, as - la);
}

const MODELS = [
  { name: "shipped log/300/mu0.2", kind: "log", div: 300, mu: 0.2, rho: -0.07 },
];
// attack/defence residual variants: per-team style offsets on the shipped
// link, learned online by Poisson SGD (att = scores more than rating says,
// con = concedes more). eta is the learning rate.
for (const eta of [0.01, 0.02, 0.04])
  MODELS.push({
    name: `style eta=${eta}`,
    kind: "style",
    div: 300,
    mu: 0.2,
    rho: -0.07,
    eta,
    att: new Map(),
    con: new Map(),
  });

// --- scoring ----------------------------------------------------------------

function mkStat() {
  return {
    n: 0,
    nll: 0, // joint scoreline -log p
    wdl: 0, // implied 1X2 -log p
    topHit: 0, // argmax cell equals the actual score
    // totals calibration by mismatch size
    buckets: [0, 1, 2].map(() => ({ n: 0, pred: 0, act: 0 })),
  };
}
const bucketOf = (adiff) => (adiff < 100 ? 0 : adiff < 250 ? 1 : 2);

function scoreMatch(stat, m, diff, hs, as, homeTeam, awayTeam) {
  const { lh, la } = lambdas(m, diff, homeTeam, awayTeam);
  let T = 0;
  let pCell = 0;
  let best = -1;
  let bestH = 0;
  let bestA = 0;
  let pH = 0;
  let pD = 0;
  let pA = 0;
  for (let h = 0; h <= MAX_G; h++) {
    for (let a = 0; a <= MAX_G; a++) {
      const p = poisson(h, lh) * poisson(a, la) * tau(h, a, lh, la, m.rho);
      T += p;
      if (h === Math.min(hs, MAX_G) && a === Math.min(as, MAX_G)) pCell = p;
      if (p > best) {
        best = p;
        bestH = h;
        bestA = a;
      }
      if (h > a) pH += p;
      else if (h === a) pD += p;
      else pA += p;
    }
  }
  stat.n++;
  stat.nll += -Math.log(Math.max(1e-12, pCell / T));
  const out = hs > as ? pH : hs === as ? pD : pA;
  stat.wdl += -Math.log(Math.max(1e-12, out / T));
  if (bestH === hs && bestA === as) stat.topHit++;
  const b = stat.buckets[bucketOf(Math.abs(diff))];
  b.n++;
  b.pred += lh + la;
  b.act += hs + as;
}

// --- main -------------------------------------------------------------------

const res = await fetch(CSV);
const matches = parseCSV(await res.text());

const ratings = new Map();
const played = new Map();
const get = (t) => ratings.get(t) ?? 1500;
const stats = new Map(MODELS.map((m) => [m.name, mkStat()]));
// context calibration for the eventual winner: actual/predicted totals by K
const ctx = new Map(); // K weight -> {pred, act, n} under a reference log model
const REF = { kind: "log", div: 350, mu: 0.25, rho: -0.1 };

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

  if (
    m.date >= EVAL_START &&
    (played.get(m.home) ?? 0) >= MIN_MATCHES &&
    (played.get(m.away) ?? 0) >= MIN_MATCHES
  ) {
    const diff = Ra + hfa - Rb;
    for (const mod of MODELS) scoreMatch(stats.get(mod.name), mod, diff, hs, as, m.home, m.away);
    const K = weight(m.tournament);
    const { lh, la } = lambdas(REF, diff, m.home, m.away);
    const c = ctx.get(K) ?? { pred: 0, act: 0, n: 0 };
    c.pred += lh + la;
    c.act += hs + as;
    c.n++;
    ctx.set(K, c);
  }

  for (const mod of MODELS) styleUpdate(mod, m.home, m.away, Ra + hfa - Rb, hs, as);

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

const rows = [...stats.entries()].sort(
  (a, b) => a[1].nll / a[1].n - b[1].nll / b[1].n
);
console.log(`n=${rows[0][1].n} matches\n`);
console.log("=== GOALS MODELS (sorted by scoreline log loss) ===");
console.log("model".padEnd(26), "scoreNLL", "1X2-ll", "exact%", "totals pred/act by |diff|<100,<250,250+");
for (const [name, s] of rows.slice(0, 8)) {
  const tb = s.buckets
    .map((b) => `${(b.pred / b.n).toFixed(2)}/${(b.act / b.n).toFixed(2)}`)
    .join("  ");
  console.log(
    name.padEnd(26),
    (s.nll / s.n).toFixed(4),
    (s.wdl / s.n).toFixed(4),
    ((s.topHit / s.n) * 100).toFixed(1) + "%",
    tb
  );
}
const ship = stats.get(MODELS[0].name);
const rank = rows.findIndex(([n]) => n === MODELS[0].name) + 1;
console.log(`\nshipped ranks #${rank}/${rows.length}:`,
  (ship.nll / ship.n).toFixed(4),
  (ship.wdl / ship.n).toFixed(4),
  ((ship.topHit / ship.n) * 100).toFixed(1) + "%",
  ship.buckets.map((b) => `${(b.pred / b.n).toFixed(2)}/${(b.act / b.n).toFixed(2)}`).join("  ")
);

console.log("\n=== CONTEXT (actual/predicted total goals under ref log/350/mu0.25) ===");
const KNAMES = { 60: "WC finals", 50: "continental", 40: "quals/NL", 30: "other", 20: "friendlies" };
for (const [K, c] of [...ctx.entries()].sort((a, b) => b[0] - a[0])) {
  console.log(
    `${KNAMES[K] ?? K}`.padEnd(12),
    "n=" + String(c.n).padEnd(6),
    "actual", (c.act / c.n).toFixed(2),
    "predicted", (c.pred / c.n).toFixed(2),
    "ratio", (c.act / c.pred).toFixed(3)
  );
}
