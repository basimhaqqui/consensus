// Pick'em core: types, localStorage persistence, scoring. Client-safe, no React.
// Scoring: winner 3, method +2, round +1 (round only counts on finishes).

export type Method = "ko" | "sub" | "dec";
export type Side = "a" | "b";

export type PickResult = {
  winnerSide: Side | null; // null = draw/NC
  method: Method | null;
  round: number | null;
  nc?: boolean;
  userPts: number;
  modelPts: number;
};

export type Pick = {
  eventId: string;
  event: string;
  date: string;
  a: { id: string | null; name: string | null };
  b: { id: string | null; name: string | null };
  w: Side;
  m: Method;
  r: number | null; // null when m === "dec"
  model: { w: Side; m: Method; r: number | null };
  at: string;
  graded?: PickResult;
};

const KEY = "picks:v1";

export function loadPicks(): Record<string, Pick> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function savePicks(picks: Record<string, Pick>) {
  localStorage.setItem(KEY, JSON.stringify(picks));
}

export function points(guess: { w: Side; m: Method; r: number | null }, res: { winnerSide: Side | null; method: Method | null; round: number | null }): number {
  if (res.winnerSide === null) return 0; // draw/NC voids the fight
  let pts = 0;
  if (guess.w === res.winnerSide) pts += 3;
  if (res.method && guess.m === res.method) pts += 2;
  if (res.method && res.method !== "dec" && guess.r !== null && guess.r === res.round && guess.m === res.method)
    pts += 1;
  return pts;
}

// "KO/TKO" / "Sub" / "U Dec" / "decision---unanimous" / "kotko" → our three classes.
export function classifyMethod(name: string | null | undefined): Method | null {
  if (!name) return null;
  const s = name.toLowerCase();
  if (s.includes("dec")) return "dec";
  if (s.includes("sub")) return "sub";
  if (s.includes("ko") || s.startsWith("tko")) return "ko";
  return null;
}

export function grade(pick: Pick, res: { winnerSide: Side | null; method: Method | null; round: number | null; nc?: boolean }): PickResult {
  return {
    ...res,
    userPts: points({ w: pick.w, m: pick.m, r: pick.r }, res),
    modelPts: points(pick.model, res),
  };
}
