// Pricing math for the Bet Lab. Every price is derived from the model's validated outputs
// (win prob + fight-level method distribution) plus historical finish-round shares; combined
// props assume independence between "who wins" and "how it ends" — a labeled approximation.

export type FightPricing = {
  boutId: string;
  date: string;
  aName: string | null;
  bName: string | null;
  pA: number; // model win prob for A
  bookPA: number | null;
  method: { ko: number; sub: number; dec: number } | null;
  fiveRounds: boolean;
  ratingA: number;
  ratingB: number;
  fightsA: number;
  fightsB: number;
};

// Given a finish, which round it lands in (UFC 2015+; 5R tail redistributed for main events).
const ROUNDS_3 = { 1: 0.505, 2: 0.326, 3: 0.169 } as const;
const ROUNDS_5 = { 1: 0.44, 2: 0.28, 3: 0.15, 4: 0.08, 5: 0.05 } as const;

export type Leg = {
  boutId: string;
  label: string;
  p: number;
};

export function fairDecimal(p: number): number {
  return 1 / Math.max(1e-6, p);
}

export function american(p: number): string {
  const q = Math.min(0.995, Math.max(0.005, p));
  return q >= 0.5 ? `−${Math.round((100 * q) / (1 - q))}` : `+${Math.round((100 * (1 - q)) / q)}`;
}

const lastName = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");

// The full menu of bets the model can honestly price for one fight.
export function legsFor(f: FightPricing): Leg[] {
  const legs: Leg[] = [];
  const a = lastName(f.aName);
  const b = lastName(f.bName);
  legs.push({ boutId: f.boutId, label: `${a} wins`, p: f.pA });
  legs.push({ boutId: f.boutId, label: `${b} wins`, p: 1 - f.pA });

  const m = f.method;
  if (!m) return legs;
  const finish = m.ko + m.sub;

  legs.push({ boutId: f.boutId, label: `Fight ends by KO/TKO`, p: m.ko });
  legs.push({ boutId: f.boutId, label: `Fight ends by submission`, p: m.sub });
  legs.push({ boutId: f.boutId, label: `Goes the distance`, p: m.dec });
  legs.push({ boutId: f.boutId, label: `Doesn't go the distance`, p: finish });

  for (const [name, p] of [
    [a, f.pA],
    [b, 1 - f.pA],
  ] as const) {
    legs.push({ boutId: f.boutId, label: `${name} by KO/TKO`, p: p * m.ko });
    legs.push({ boutId: f.boutId, label: `${name} by submission`, p: p * m.sub });
    legs.push({ boutId: f.boutId, label: `${name} by decision`, p: p * m.dec });
    legs.push({ boutId: f.boutId, label: `${name} inside the distance`, p: p * finish });
  }

  const rounds = f.fiveRounds ? ROUNDS_5 : ROUNDS_3;
  for (const [r, share] of Object.entries(rounds)) {
    legs.push({ boutId: f.boutId, label: `Finish in round ${r}`, p: finish * share });
  }
  if (f.fiveRounds) {
    legs.push({
      boutId: f.boutId,
      label: `Finish in championship rounds (R4–5)`,
      p: finish * (ROUNDS_5[4] + ROUNDS_5[5]),
    });
  }
  return legs;
}

// One leg per fight: legs within the same fight are correlated, and multiplying
// correlated probabilities lies about the parlay price.
export function parlayProb(legs: Leg[]): number | null {
  const seen = new Set<string>();
  let p = 1;
  for (const l of legs) {
    if (seen.has(l.boutId)) return null;
    seen.add(l.boutId);
    p *= l.p;
  }
  return p;
}
