// Online Elo replay over data/fights.json: predict every fight BEFORE updating ratings,
// score log loss / Brier / calibration on the eval window, then grid-search the constants.
// This is the gate for every model change — nothing ships without beating the incumbent here.
//
// Usage: node scripts/backtest.mjs          (score the current DEFAULT config)
//        node scripts/backtest.mjs --grid   (grid-search constants, print leaderboard)

import { readFileSync } from "node:fs";

const fights = JSON.parse(readFileSync(new URL("../../data/ufc/fights.json", import.meta.url), "utf8"));
let fighters = {};
try {
  fighters = JSON.parse(readFileSync(new URL("../../data/ufc/fighters.json", import.meta.url), "utf8"));
} catch {}

const EVAL_FROM = process.env.EVAL_FROM ?? "2012-01-01"; // burn-in: everything earlier only trains ratings
const EVAL_TO = process.env.EVAL_TO ?? "9999";
const BASE_RATING = 1500;

// Pre-UFC net wins per fighter: career record (ESPN) minus their complete UFC record.
// Approximation — assumes no non-UFC fights after debut — but the backtest is the judge.
const ufcTot = new Map();
for (const f of fights) {
  if (f.winnerId === null) continue;
  for (const [id, won] of [[String(f.a.id), f.winnerId === f.a.id], [String(f.b.id), f.winnerId === f.b.id]]) {
    const t = ufcTot.get(id) ?? { w: 0, l: 0 };
    if (won) t.w++;
    else t.l++;
    ufcTot.set(id, t);
  }
}
const preNet = new Map();
for (const [id, t] of ufcTot) {
  const m = fighters[id]?.proRecord?.match(/^(\d+)-(\d+)/);
  if (!m) continue;
  const preW = Math.max(0, +m[1] - t.w);
  const preL = Math.max(0, +m[2] - t.l);
  preNet.set(id, Math.max(-15, Math.min(15, preW - preL)));
}

export const DEFAULT = {
  k: 80, // base K-factor
  provFights: 5, // first N fights carry extra K
  provMult: 1.5, // ...multiplied by this
  finishMult: 1.25, // K multiplier when the fight didn't go the distance
  layoffRho: 0.3, // regress toward BASE per year inactive beyond 12 months
  agePenalty: 20, // Elo docked per year of age above ageKnee at fight time
  ageKnee: 26,
  scale: 600, // Elo-diff divisor in the win-prob logistic (fitted, like the /210 link in consensus)
  priorCoef: 6, // Elo per net pre-UFC win seeded into a debutant's initial rating
};

function ageAt(fighterId, dateISO) {
  const dob = fighters[String(fighterId)]?.dob;
  if (!dob) return null;
  return (new Date(dateISO) - new Date(dob)) / (365.25 * 864e5);
}

function replay(cfg) {
  const rating = new Map();
  const count = new Map();
  const lastDate = new Map();
  const get = (id) => rating.get(id) ?? BASE_RATING + (cfg.priorCoef ?? 0) * (preNet.get(id) ?? 0);

  const preds = []; // {p, won, both3}

  for (const f of fights) {
    if (f.winnerId === null) continue; // draws/NCs: rare, and NC results carry no signal
    const [ia, ib] = [String(f.a.id), String(f.b.id)];
    const t = new Date(f.date);

    // Layoff: pull a returning fighter's rating toward the mean before predicting.
    for (const id of [ia, ib]) {
      const last = lastDate.get(id);
      if (last && cfg.layoffRho > 0) {
        const idleYears = (t - last) / (365.25 * 864e5) - 1;
        if (idleYears > 0) {
          const keep = Math.max(0, 1 - cfg.layoffRho * idleYears);
          rating.set(id, BASE_RATING + (get(id) - BASE_RATING) * keep);
        }
      }
    }

    let ra = get(ia);
    let rb = get(ib);
    if (cfg.agePenalty > 0) {
      const [aa, ab] = [ageAt(ia, f.date), ageAt(ib, f.date)];
      if (aa !== null) ra -= cfg.agePenalty * Math.max(0, aa - cfg.ageKnee);
      if (ab !== null) rb -= cfg.agePenalty * Math.max(0, ab - cfg.ageKnee);
    }

    const p = 1 / (1 + 10 ** (-(ra - rb) / cfg.scale));
    const aWon = f.winnerId === f.a.id;

    if (f.date >= EVAL_FROM && f.date < EVAL_TO) {
      preds.push({ p, won: aWon, both3: (count.get(ia) ?? 0) >= 3 && (count.get(ib) ?? 0) >= 3 });
    }

    // Update (raw ratings, not age-adjusted ones).
    const kOf = (id) => cfg.k * ((count.get(id) ?? 0) < cfg.provFights ? cfg.provMult : 1);
    const mult = f.decision ? 1 : cfg.finishMult;
    const exp = 1 / (1 + 10 ** (-(get(ia) - get(ib)) / 400));
    const err = (aWon ? 1 : 0) - exp;
    rating.set(ia, get(ia) + kOf(ia) * mult * err);
    rating.set(ib, get(ib) - kOf(ib) * mult * err);
    for (const id of [ia, ib]) {
      count.set(id, (count.get(id) ?? 0) + 1);
      lastDate.set(id, t);
    }
  }
  return preds;
}

function score(preds) {
  let ll = 0;
  let brier = 0;
  let hits = 0;
  const buckets = new Map();
  for (const { p, won } of preds) {
    const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
    ll -= won ? Math.log(q) : Math.log(1 - q);
    brier += (p - (won ? 1 : 0)) ** 2;
    // fold to the favorite for accuracy + calibration
    const fav = Math.max(p, 1 - p);
    const favWon = p >= 0.5 ? won : !won;
    if (favWon) hits++;
    const bk = Math.min(9, Math.floor(fav * 10));
    const b = buckets.get(bk) ?? { n: 0, won: 0, sum: 0 };
    b.n++;
    b.sum += fav;
    if (favWon) b.won++;
    buckets.set(bk, b);
  }
  const n = preds.length;
  return { n, logLoss: ll / n, brier: brier / n, acc: hits / n, buckets };
}

function report(label, preds) {
  const all = score(preds);
  const est = score(preds.filter((x) => x.both3));
  console.log(
    `${label}  n=${all.n}  logloss=${all.logLoss.toFixed(4)}  brier=${all.brier.toFixed(4)}  acc=${(all.acc * 100).toFixed(1)}%` +
      `  | both≥3 fights: n=${est.n}  logloss=${est.logLoss.toFixed(4)}  acc=${(est.acc * 100).toFixed(1)}%`
  );
  return all;
}

function calibration(preds) {
  const { buckets } = score(preds);
  console.log("\ncalibration (favorite prob → actual win rate):");
  for (const k of [...buckets.keys()].sort()) {
    const b = buckets.get(k);
    console.log(
      `  ${(k * 10).toString().padStart(2)}–${k * 10 + 10}%: predicted ${((b.sum / b.n) * 100).toFixed(1)}%  actual ${((b.won / b.n) * 100).toFixed(1)}%  (n=${b.n})`
    );
  }
}

const grid = process.argv.includes("--grid");
const hasDob = Object.values(fighters).some((f) => f?.dob);

if (!grid) {
  const override = process.env.CONFIG ? JSON.parse(process.env.CONFIG) : {};
  const preds = replay({ ...DEFAULT, ...override });
  console.log(`fights: ${fights.length}, fighters with DOB: ${hasDob ? "yes" : "NO (run scrape-fighters.mjs)"}`);
  report("DEFAULT", preds);
  console.log(`baseline coinflip logloss=${Math.log(2).toFixed(4)}`);
  calibration(preds);
} else {
  const results = [];
  for (const k of [64, 80, 96, 112])
    for (const provMult of [1.5])
      for (const finishMult of [1.25])
        for (const layoffRho of [0.3])
          for (const agePenalty of hasDob ? [16, 20, 24] : [0])
            for (const ageKnee of hasDob ? [24, 26, 28] : [34])
            for (const scale of [500, 600, 700, 800]) {
              const cfg = { ...DEFAULT, k, provMult, finishMult, layoffRho, agePenalty, ageKnee, scale };
              const s = score(replay(cfg));
              results.push({ cfg, ...s });
            }
  results.sort((a, b) => a.logLoss - b.logLoss);
  console.log(`top 10 of ${results.length} configs (by log loss):`);
  for (const r of results.slice(0, 10)) {
    const c = r.cfg;
    console.log(
      `  logloss=${r.logLoss.toFixed(4)} acc=${(r.acc * 100).toFixed(1)}%  K=${c.k} prov×${c.provMult} finish×${c.finishMult} layoff=${c.layoffRho} age=${c.agePenalty}@${c.ageKnee} scale=${c.scale}`
    );
  }
  console.log(`\nworst: logloss=${results.at(-1).logLoss.toFixed(4)}  (coinflip=${Math.log(2).toFixed(4)})`);
}
