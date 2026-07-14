// Fight-level method model: P(ko), P(sub), P(dec) for how a fight ends.
// Online replay, predict-before-update, like the Elo. Ingredients:
//   - global + per-weight-class base rates with exponential forgetting (early-UFC was
//     finish-heavy; decay keeps the base rates modern)
//   - per-fighter "how do this fighter's fights end" counts, shrunk toward the class base
//     by k pseudo-fights, averaged across both fighters, renormalized.
// Constants are validated by backtest-method.mjs before they ship.

export const METHOD_DEFAULT = {
  k: 4, // pseudo-fights of class-base shrinkage per fighter
  decay: 0.999, // per-fight forgetting on global/class base counts
  classShrink: 50, // pseudo-fights of global shrinkage on a class's base rates
};

export const CLASSES = ["ko", "sub", "dec"];

export function classify(resultName) {
  if (!resultName) return null;
  if (resultName === "kotko" || resultName.startsWith("tko")) return "ko";
  if (resultName.startsWith("submission")) return "sub";
  if ((resultName.startsWith("decision") || resultName === "majority-decision") && !resultName.includes("draw"))
    return "dec";
  return null; // dq, no contest, draws, unknown — no method signal
}

export function buildMethodModel(fights, methods, cfg = METHOD_DEFAULT, onPredict) {
  const global = { ko: 1, sub: 1, dec: 1 };
  const byClass = new Map(); // weightClass -> counts
  const byFighter = new Map(); // id -> counts + n

  const rates = (c) => {
    const n = c.ko + c.sub + c.dec;
    return { ko: c.ko / n, sub: c.sub / n, dec: c.dec / n, n };
  };

  const baseFor = (weightClass) => {
    const g = rates(global);
    const c = byClass.get(weightClass);
    if (!c) return g;
    const cr = rates(c);
    const w = cr.n / (cr.n + cfg.classShrink);
    return {
      ko: w * cr.ko + (1 - w) * g.ko,
      sub: w * cr.sub + (1 - w) * g.sub,
      dec: w * cr.dec + (1 - w) * g.dec,
    };
  };

  const predict = (aId, bId, weightClass) => {
    const base = baseFor(weightClass);
    const mix = { ko: 0, sub: 0, dec: 0 };
    for (const id of [String(aId), String(bId)]) {
      const f = byFighter.get(id);
      const n = f ? f.ko + f.sub + f.dec : 0;
      for (const x of CLASSES) {
        const rate = ((f?.[x] ?? 0) + cfg.k * base[x]) / (n + cfg.k);
        mix[x] += rate / 2;
      }
    }
    const s = mix.ko + mix.sub + mix.dec;
    return { ko: mix.ko / s, sub: mix.sub / s, dec: mix.dec / s };
  };

  for (const f of fights) {
    const cls = classify(methods[f.boutId]);
    if (cls === null) continue;

    if (onPredict) onPredict(f, cls, predict(f.a.id, f.b.id, f.weightClass));

    // decayed base updates
    for (const x of CLASSES) global[x] *= cfg.decay;
    global[cls] += 1;
    const wc = f.weightClass ?? "?";
    if (!byClass.has(wc)) byClass.set(wc, { ko: 0.5, sub: 0.5, dec: 0.5 });
    const c = byClass.get(wc);
    for (const x of CLASSES) c[x] *= cfg.decay;
    c[cls] += 1;
    // fighter counts, undecayed
    for (const id of [String(f.a.id), String(f.b.id)]) {
      if (!byFighter.has(id)) byFighter.set(id, { ko: 0, sub: 0, dec: 0 });
      byFighter.get(id)[cls] += 1;
    }
  }

  return { predict };
}
