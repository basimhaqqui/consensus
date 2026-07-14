// Multiclass backtest for the method model — same discipline as backtest.mjs:
// predict before update, score log loss on the eval window, compare against the
// no-skill baselines (global rates, class rates), grid the constants.
//
// Usage: node scripts/backtest-method.mjs          (score METHOD_DEFAULT)
//        node scripts/backtest-method.mjs --grid   (grid-search constants)

import { readFileSync } from "node:fs";
import { buildMethodModel, METHOD_DEFAULT, CLASSES, classify } from "./method-model.mjs";

const fights = JSON.parse(readFileSync(new URL("../../data/ufc/fights.json", import.meta.url), "utf8"));
const methods = JSON.parse(readFileSync(new URL("../../data/ufc/methods.json", import.meta.url), "utf8"));

const EVAL_FROM = process.env.EVAL_FROM ?? "2012-01-01";
const EVAL_TO = process.env.EVAL_TO ?? "9999";

function score(cfg) {
  let ll = 0;
  let n = 0;
  let hits = 0;
  buildMethodModel(fights, methods, cfg, (f, cls, p) => {
    if (f.date < EVAL_FROM || f.date >= EVAL_TO) return;
    ll -= Math.log(Math.max(1e-9, p[cls]));
    const pick = CLASSES.reduce((a, b) => (p[a] >= p[b] ? a : b));
    if (pick === cls) hits++;
    n++;
  });
  return { logLoss: ll / n, acc: hits / n, n };
}

// no-skill baselines over the same eval fights
function baselines() {
  const inWin = (f) => f.date >= EVAL_FROM && f.date < EVAL_TO;
  const evalFights = fights.filter((f) => inWin(f) && classify(methods[f.boutId]));
  // global: running rates over all prior fights (predict-before-update)
  const g = { ko: 1, sub: 1, dec: 1 };
  const c = new Map();
  let llG = 0;
  let llC = 0;
  let n = 0;
  for (const f of fights) {
    const cls = classify(methods[f.boutId]);
    if (!cls) continue;
    if (inWin(f)) {
      const gs = g.ko + g.sub + g.dec;
      llG -= Math.log(g[cls] / gs);
      const cc = c.get(f.weightClass) ?? g;
      const cs = cc.ko + cc.sub + cc.dec;
      llC -= Math.log(Math.max(1e-9, cc[cls] / cs));
      n++;
    }
    g[cls] += 1;
    if (!c.has(f.weightClass)) c.set(f.weightClass, { ko: 1, sub: 1, dec: 1 });
    c.get(f.weightClass)[cls] += 1;
  }
  return { llG: llG / n, llC: llC / n, n, evalN: evalFights.length };
}

if (!process.argv.includes("--grid")) {
  const b = baselines();
  const override = process.env.CONFIG ? JSON.parse(process.env.CONFIG) : {};
  const s = score({ ...METHOD_DEFAULT, ...override });
  console.log(`eval fights: ${s.n} (${EVAL_FROM} → ${EVAL_TO})`);
  console.log(`baseline global rates:  logloss=${b.llG.toFixed(4)}`);
  console.log(`baseline class rates:   logloss=${b.llC.toFixed(4)}`);
  console.log(`method model (DEFAULT): logloss=${s.logLoss.toFixed(4)}  top-1 acc=${(s.acc * 100).toFixed(1)}%`);
} else {
  const results = [];
  for (const k of [4, 8, 16, 32])
    for (const decay of [1, 0.9995, 0.999])
      for (const classShrink of [20, 50, 100]) {
        const cfg = { k, decay, classShrink };
        results.push({ cfg, ...score(cfg) });
      }
  results.sort((a, b) => a.logLoss - b.logLoss);
  console.log(`top 8 of ${results.length}:`);
  for (const r of results.slice(0, 8))
    console.log(
      `  logloss=${r.logLoss.toFixed(4)} acc=${(r.acc * 100).toFixed(1)}%  k=${r.cfg.k} decay=${r.cfg.decay} classShrink=${r.cfg.classShrink}`
    );
}
