// Derived betting markets from the model's joint scoreline distribution.
// Pure functions (no fetch, no server deps) so both server components and the
// client-side bet builder can price identical markets from a match's lambdas.
//
// Books price single markets with ~5% margin and bet-builder combos with far
// more; pricing combos off the SAME joint grid (not naive independence) is
// the honest way to do it — "home win + over 2.5" are correlated and the grid
// knows exactly how much.

// Mirrors lib/model.ts (RHO, MAX) — keep in sync with the fitted constants.
const RHO = -0.07;
const MAX = 8;

function poisson(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

function tau(h: number, a: number, lh: number, la: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

export type Grid = { p: number[][]; total: number };

export function scoreGrid(lambdaHome: number, lambdaAway: number): Grid {
  const p: number[][] = [];
  let total = 0;
  for (let h = 0; h <= MAX; h++) {
    p[h] = [];
    for (let a = 0; a <= MAX; a++) {
      const v =
        poisson(h, lambdaHome) * poisson(a, lambdaAway) * tau(h, a, lambdaHome, lambdaAway);
      p[h][a] = v;
      total += v;
    }
  }
  return { p, total };
}

// A leg is a WEIGHT over the 90' scoreline: 1/0 for boolean markets, a
// conditional probability for player markets (P(player scores | team scored
// g goals) = 1-(1-share)^g). Combos within one match integrate the product
// of weights over the grid — exact joint pricing, correlations included.
export type LegDef = {
  key: string; // stable id, e.g. "over2.5"
  label: string; // display, e.g. "Over 2.5 goals"
  group: string; // section header in the picker
  weight: (h: number, a: number) => number;
};

const bool = (test: (h: number, a: number) => boolean) => (h: number, a: number) =>
  test(h, a) ? 1 : 0;

export function marketLegs(homeCode: string, awayCode: string): LegDef[] {
  return [
    { key: "home", label: `${homeCode} win`, group: "Result", weight: bool((h, a) => h > a) },
    { key: "draw", label: "Draw", group: "Result", weight: bool((h, a) => h === a) },
    { key: "away", label: `${awayCode} win`, group: "Result", weight: bool((h, a) => h < a) },
    { key: "dc-1x", label: `${homeCode} or draw`, group: "Double chance", weight: bool((h, a) => h >= a) },
    { key: "dc-x2", label: `${awayCode} or draw`, group: "Double chance", weight: bool((h, a) => h <= a) },
    { key: "dc-12", label: "No draw", group: "Double chance", weight: bool((h, a) => h !== a) },
    { key: "over1.5", label: "Over 1.5 goals", group: "Totals", weight: bool((h, a) => h + a > 1) },
    { key: "under1.5", label: "Under 1.5 goals", group: "Totals", weight: bool((h, a) => h + a < 2) },
    { key: "over2.5", label: "Over 2.5 goals", group: "Totals", weight: bool((h, a) => h + a > 2) },
    { key: "under2.5", label: "Under 2.5 goals", group: "Totals", weight: bool((h, a) => h + a < 3) },
    { key: "over3.5", label: "Over 3.5 goals", group: "Totals", weight: bool((h, a) => h + a > 3) },
    { key: "under3.5", label: "Under 3.5 goals", group: "Totals", weight: bool((h, a) => h + a < 4) },
    { key: "btts-y", label: "Both teams score", group: "Goals", weight: bool((h, a) => h > 0 && a > 0) },
    { key: "btts-n", label: "Not both score", group: "Goals", weight: bool((h, a) => h === 0 || a === 0) },
    { key: "cs-home", label: `${homeCode} clean sheet`, group: "Goals", weight: bool((_h, a) => a === 0) },
    { key: "cs-away", label: `${awayCode} clean sheet`, group: "Goals", weight: bool((h) => h === 0) },
    { key: "ht-o0.5", label: `${homeCode} to score`, group: "Goals", weight: bool((h) => h > 0) },
    { key: "at-o0.5", label: `${awayCode} to score`, group: "Goals", weight: bool((_h, a) => a > 0) },
  ];
}

// Joint probability of a set of legs in ONE match: E[ Π weights ] over the
// scoreline distribution. Player legs are conditionally independent of each
// other and of result legs GIVEN the scoreline, which the product encodes.
export function jointProb(grid: Grid, legs: LegDef[]): number {
  let sum = 0;
  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      let w = grid.p[h][a];
      for (const l of legs) w *= l.weight(h, a);
      sum += w;
    }
  }
  return sum / grid.total;
}

export function probOf(grid: Grid, leg: LegDef): number {
  return jointProb(grid, [leg]);
}

// --- player props --------------------------------------------------------------

// share = the chance any single team goal is scored by this player (estimated
// from tournament goals-per-game vs team goals-per-game).
export type PlayerProp = {
  name: string;
  side: "home" | "away";
  share: number;
};

export function playerLegDefs(players: PlayerProp[]): LegDef[] {
  const legs: LegDef[] = [];
  for (const p of players) {
    const goals = (h: number, a: number) => (p.side === "home" ? h : a);
    legs.push({
      key: `p-${p.side}-${p.name}-1`,
      label: `${p.name} to score`,
      group: "Players",
      weight: (h, a) => 1 - Math.pow(1 - p.share, goals(h, a)),
    });
    if (p.share >= 0.35) {
      legs.push({
        key: `p-${p.side}-${p.name}-2`,
        label: `${p.name} 2+ goals`,
        group: "Players",
        weight: (h, a) => {
          const g = goals(h, a);
          if (g < 2) return 0;
          return (
            1 -
            Math.pow(1 - p.share, g) -
            g * p.share * Math.pow(1 - p.share, g - 1)
          );
        },
      });
    }
  }
  return legs;
}

// --- odds formatting ---------------------------------------------------------

export function decimalFromProb(p: number): number {
  return p > 0 ? 1 / p : Infinity;
}

export function americanFromProbStr(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.5) return `${Math.round((-100 * p) / (1 - p))}`;
  return `+${Math.round((100 * (1 - p)) / p)}`;
}

// Parse user-entered book odds: accepts American (+650, -120) or decimal (7.5).
export function parseBookOdds(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (/^[+-]\d+$/.test(s)) {
    const v = parseInt(s, 10);
    if (Math.abs(v) < 100) return null;
    return v > 0 ? 1 + v / 100 : 1 + 100 / -v;
  }
  const d = parseFloat(s);
  return Number.isFinite(d) && d > 1 ? d : null;
}
