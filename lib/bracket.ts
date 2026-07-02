import { FIXTURES, TEAMS, teamRating, type Team, type RatingSource } from "./data";
import { forecast, advanceProb } from "./model";
import type { MatchView } from "./compute";

// ---------------------------------------------------------------------------
// Knockout bracket tree (decoded from ESPN's authoritative feeder data) and a
// Monte-Carlo simulator that plays out the remaining bracket many times to
// estimate each team's odds to reach each round and win the title.
// Decided matches are respected; only undecided games are randomised.
// ---------------------------------------------------------------------------

export type Round = "R32" | "R16" | "QF" | "SF" | "Final";

// All R32 fixtures, in id order (r32-01 … r32-16).
const R32_IDS = FIXTURES.map((f) => f.id);

// Upper-bracket nodes: each fed by two earlier match winners (by id).
// Feeders are either an R32 fixture id or another node id.
type Node = { id: string; round: Round; a: string; b: string };
// Pairings verified against FIFA's official match numbers (73–104) from ESPN's
// core API — the three decided R16 ties (PAR v FRA, CAN v MAR, BRA v NOR) confirm
// the mapping. R16 node N = FIFA Round-of-16 match N.
const UPPER: Node[] = [
  { id: "r16-1", round: "R16", a: "r32-03", b: "r32-06" },
  { id: "r16-2", round: "R16", a: "r32-01", b: "r32-04" },
  { id: "r16-3", round: "R16", a: "r32-02", b: "r32-05" },
  { id: "r16-4", round: "R16", a: "r32-07", b: "r32-08" },
  { id: "r16-5", round: "R16", a: "r32-12", b: "r32-11" },
  { id: "r16-6", round: "R16", a: "r32-10", b: "r32-09" },
  { id: "r16-7", round: "R16", a: "r32-15", b: "r32-14" },
  { id: "r16-8", round: "R16", a: "r32-13", b: "r32-16" },
  { id: "qf-1", round: "QF", a: "r16-1", b: "r16-2" },
  { id: "qf-2", round: "QF", a: "r16-5", b: "r16-6" },
  { id: "qf-3", round: "QF", a: "r16-3", b: "r16-4" },
  { id: "qf-4", round: "QF", a: "r16-7", b: "r16-8" },
  { id: "sf-1", round: "SF", a: "qf-1", b: "qf-2" },
  { id: "sf-2", round: "SF", a: "qf-3", b: "qf-4" },
  { id: "final", round: "Final", a: "sf-1", b: "sf-2" },
];

const R16_IDS = UPPER.filter((n) => n.round === "R16").map((n) => n.id);
const QF_IDS = UPPER.filter((n) => n.round === "QF").map((n) => n.id);
const SF_IDS = UPPER.filter((n) => n.round === "SF").map((n) => n.id);

// Neutral-venue win probability between two ratings (memoised).
const wpCache = new Map<string, number>();
function winProbR(ra: number, rb: number): number {
  const key = `${ra}|${rb}`;
  const hit = wpCache.get(key);
  if (hit !== undefined) return hit;
  const o = forecast(ra, rb);
  const ap = advanceProb(o, ra, rb);
  wpCache.set(key, ap.home);
  return ap.home;
}

export type SimRow = {
  key: string;
  name: string;
  flag: string;
  champ: number;
  final: number;
  sf: number;
  qf: number;
  r16: number;
};

export function simulate(
  matches: MatchView[],
  iters = 10000,
  source: RatingSource = "model"
): SimRow[] {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const fixById = new Map(FIXTURES.map((f) => [f.id, f]));
  const R = (key: string) => teamRating(key, source);

  const champ: Record<string, number> = {};
  const final: Record<string, number> = {};
  const sf: Record<string, number> = {};
  const qf: Record<string, number> = {};
  const r16: Record<string, number> = {};
  const bump = (o: Record<string, number>, k: string) => (o[k] = (o[k] || 0) + 1);

  for (let i = 0; i < iters; i++) {
    const res: Record<string, string> = {};

    // Round of 32
    for (const fid of R32_IDS) {
      const m = byId.get(fid);
      if (m && m.status === "final" && m.winnerKey) {
        res[fid] = m.winnerKey;
        continue;
      }
      const f = fixById.get(fid)!;
      const ra = R(f.home) + (f.homeAdv ?? 0);
      const rb = R(f.away);
      res[fid] = Math.random() < winProbR(ra, rb) ? f.home : f.away;
    }
    R32_IDS.forEach((fid) => bump(r16, res[fid])); // R32 winners reach R16

    // Upper rounds (UPPER is in dependency order)
    for (const node of UPPER) {
      const a = res[node.a];
      const b = res[node.b];
      res[node.id] = Math.random() < winProbR(R(a), R(b)) ? a : b;
    }

    R16_IDS.forEach((id) => bump(qf, res[id])); // R16 winners reach QF
    QF_IDS.forEach((id) => bump(sf, res[id])); // QF winners reach SF
    SF_IDS.forEach((id) => bump(final, res[id])); // SF winners reach final
    bump(champ, res["final"]); // final winner = champion
  }

  return Object.entries(TEAMS)
    .map(([key, t]: [string, Team]) => ({
      key,
      name: t.name,
      flag: t.flag,
      champ: (champ[key] || 0) / iters,
      final: (final[key] || 0) / iters,
      sf: (sf[key] || 0) / iters,
      qf: (qf[key] || 0) / iters,
      r16: (r16[key] || 0) / iters,
    }))
    .filter((r) => r.r16 > 0)
    .sort((a, b) => b.champ - a.champ || b.final - a.final);
}

// ---------------------------------------------------------------------------
// Bracket view — resolve the full tree into rounds for visual rendering.
// R32 carries live scores; later rounds fill in as feeders are decided.
// ---------------------------------------------------------------------------

export type Slot = { key?: string; label: string };

export type BracketMatch = {
  id: string;
  round: Round;
  home: Slot;
  away: Slot;
  score?: { home: number; away: number };
  status: "scheduled" | "live" | "final";
  winnerKey?: string;
  detail?: string;
  feeders?: [string, string]; // ids feeding this match (undefined for R32)
};

export function getBracket(matches: MatchView[]) {
  const byId = new Map(matches.map((m) => [m.id, m]));

  // Resolve the team feeding a slot from feeder id (R32 fixture or node).
  const resolveSlot = (feeder: string): Slot => {
    if (feeder.startsWith("r32-")) {
      const m = byId.get(feeder);
      if (m && m.status === "final" && m.winnerKey) {
        return { key: m.winnerKey, label: TEAMS[m.winnerKey].name };
      }
      if (m) return { label: `${TEAMS[m.homeKey].code}/${TEAMS[m.awayKey].code}` };
    }
    return { label: "TBD" };
  };

  const r32: BracketMatch[] = R32_IDS.map((fid) => {
    const m = byId.get(fid)!;
    return {
      id: fid,
      round: "R32" as Round,
      home: { key: m.homeKey, label: m.home.name },
      away: { key: m.awayKey, label: m.away.name },
      score: m.score,
      status: m.status,
      winnerKey: m.winnerKey,
      detail: m.live?.detail ?? m.date,
    };
  });

  const upper: BracketMatch[] = UPPER.map((node) => ({
    id: node.id,
    round: node.round,
    home: resolveSlot(node.a),
    away: resolveSlot(node.b),
    status: "scheduled" as const,
    feeders: [node.a, node.b] as [string, string],
  }));

  const all = [...r32, ...upper];
  const byRound = (r: Round) => all.filter((m) => m.round === r);

  return {
    R32: byRound("R32"),
    R16: byRound("R16"),
    QF: byRound("QF"),
    SF: byRound("SF"),
    Final: byRound("Final"),
  };
}
