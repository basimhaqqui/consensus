// Auto-suggested slips for the bet builder: where the model disagrees with
// the books (VALUE), same-match combos whose legs are positively correlated
// (COMBO — books price these near-independently plus margin), confident
// cross-match accumulators (ACCA), and player-prop angles (PROP). All legs
// reference the same legKeys the builder's picker generates, so a suggestion
// can be loaded straight into the slip.

import {
  scoreGrid,
  marketLegs,
  playerLegDefs,
  jointProb,
  probOf,
  americanFromProbStr,
  type LegDef,
  type PlayerProp,
} from "./markets";

export type SuggestionLeg = { matchId: string; legKey: string };

export type Suggestion = {
  tag: "VALUE" | "COMBO" | "ACCA" | "PROP";
  title: string;
  rationale: string;
  legs: SuggestionLeg[];
  prob: number;
  fair: string;
};

export type SuggestionMatch = {
  id: string;
  homeCode: string;
  awayCode: string;
  lambdaHome: number;
  lambdaAway: number;
  market?: { pHome: number; pDraw: number; pAway: number } | null;
  players?: PlayerProp[];
};

const pctStr = (p: number) => `${Math.round(p * 100)}%`;

export function buildSuggestions(matches: SuggestionMatch[]): Suggestion[] {
  const out: Suggestion[] = [];

  const ctx = matches.map((m) => {
    const grid = scoreGrid(m.lambdaHome, m.lambdaAway);
    const xg = `${m.lambdaHome.toFixed(1)}–${m.lambdaAway.toFixed(1)}`;
    const legs = [...marketLegs(m.homeCode, m.awayCode), ...playerLegDefs(m.players ?? [])];
    const by = new Map(legs.map((l) => [l.key, l]));
    const p = (key: string) => {
      const l = by.get(key);
      return l ? probOf(grid, l) : 0;
    };
    return { m, grid, by, p, xg };
  });

  // --- VALUE: model vs de-vigged books, result family --------------------------
  const values: (Suggestion & { edge: number })[] = [];
  for (const { m, p, xg } of ctx) {
    if (!m.market) continue;
    const rows: [string, number, number, string][] = [
      ["home", p("home"), m.market.pHome, `${m.homeCode} win`],
      ["away", p("away"), m.market.pAway, `${m.awayCode} win`],
      ["dc-1x", p("dc-1x"), m.market.pHome + m.market.pDraw, `${m.homeCode} or draw`],
      ["dc-x2", p("dc-x2"), m.market.pAway + m.market.pDraw, `${m.awayCode} or draw`],
    ];
    for (const [key, model, books, label] of rows) {
      const edge = model - books;
      if (edge < 0.06) continue;
      values.push({
        tag: "VALUE",
        title: `${label} — model sees value`,
        rationale: `Model ${pctStr(model)} vs books ${pctStr(books)} — a +${(edge * 100).toFixed(0)}pt gap. The model's ${xg} goal projection reads this tie differently than the market; you're backing our Elo against the books' price.`,
        legs: [{ matchId: m.id, legKey: key }],
        prob: model,
        fair: americanFromProbStr(model),
        edge,
      });
    }
  }
  values.sort((a, b) => b.edge - a.edge);
  out.push(...values.slice(0, 2));

  // --- COMBO: positively-correlated same-match pairs ----------------------------
  const combos: (Suggestion & { corr: number })[] = [];
  for (const { m, grid, by, p, xg } of ctx) {
    const favKey = p("home") >= p("away") ? "home" : "away";
    const favCode = favKey === "home" ? m.homeCode : m.awayCode;
    const pairs: [string, string][] = [
      [favKey, "over2.5"],
      [favKey, "btts-y"],
    ];
    // favourite's top scorer + favourite win — strongly correlated
    const scorer = (m.players ?? []).find((pl) => pl.side === favKey);
    if (scorer) pairs.push([favKey, `p-${scorer.side}-${scorer.name}-1`]);

    for (const [a, b] of pairs) {
      const la = by.get(a);
      const lb = by.get(b);
      if (!la || !lb) continue;
      const joint = jointProb(grid, [la, lb]);
      const indep = probOf(grid, la) * probOf(grid, lb);
      const corr = indep > 0 ? joint / indep - 1 : 0;
      if (corr < 0.12 || joint < 0.18) continue;
      combos.push({
        tag: b.startsWith("p-") ? "PROP" : "COMBO",
        title: `${favCode} win + ${lb.label}`,
        rationale: `At ${xg} expected goals these legs rise and fall together: +${Math.round(corr * 100)}% correlated, so independent pricing says ${pctStr(indep)} but the joint score grid says ${pctStr(joint)}. Books price builders near-independently plus margin — take anything above fair.`,
        legs: [
          { matchId: m.id, legKey: a },
          { matchId: m.id, legKey: b },
        ],
        prob: joint,
        fair: americanFromProbStr(joint),
        corr,
      });
    }
  }
  combos.sort((a, b) => b.corr - a.corr);
  out.push(...combos.slice(0, 3));

  // --- ACCA: most confident leg per match, best three ---------------------------
  const accaLegs: { matchId: string; legKey: string; p: number; label: string }[] = [];
  for (const { m, p, by } of ctx) {
    const ml = p("home") >= p("away") ? "home" : "away";
    if (p(ml) >= 0.55) {
      accaLegs.push({ matchId: m.id, legKey: ml, p: p(ml), label: by.get(ml)!.label });
    } else {
      const dc = p("dc-1x") >= p("dc-x2") ? "dc-1x" : "dc-x2";
      if (p(dc) >= 0.7)
        accaLegs.push({ matchId: m.id, legKey: dc, p: p(dc), label: by.get(dc)!.label });
    }
  }
  accaLegs.sort((a, b) => b.p - a.p);
  const picked = accaLegs.slice(0, 3);
  if (picked.length >= 2) {
    const prob = picked.reduce((acc, l) => acc * l.p, 1);
    out.push({
      tag: "ACCA",
      title: picked.map((l) => l.label).join(" + "),
      rationale: `The model's most confident leg from each match (${picked
        .map((l) => pctStr(l.p))
        .join(" × ")}). Independent matches, so the multiplication is honest.`,
      legs: picked.map((l) => ({ matchId: l.matchId, legKey: l.legKey })),
      prob,
      fair: americanFromProbStr(prob),
    });
  }

  // --- PROP singles: strongest anytime-scorer prices ----------------------------
  const propSingles: (Suggestion & { p: number })[] = [];
  for (const { m, p } of ctx) {
    for (const pl of m.players ?? []) {
      const key = `p-${pl.side}-${pl.name}-1`;
      const prob = p(key);
      if (prob < 0.4) continue;
      propSingles.push({
        tag: "PROP",
        title: `${pl.name} to score`,
        rationale: `Takes ${pctStr(pl.share)} of ${
          pl.side === "home" ? m.homeCode : m.awayCode
        }'s goals this tournament, and the model projects ${(pl.side === "home" ? m.lambdaHome : m.lambdaAway).toFixed(1)} team goals here — integrated over the score grid that's ${pctStr(prob)} to strike.`,
        legs: [{ matchId: m.id, legKey: key }],
        prob,
        fair: americanFromProbStr(prob),
        p: prob,
      });
    }
  }
  propSingles.sort((a, b) => b.p - a.p);
  out.push(...propSingles.slice(0, 2));

  return out.slice(0, 7);
}
