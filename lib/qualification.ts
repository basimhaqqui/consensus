// European qualification by final league position, per competition.
//
// ESPN's standings notes are inconsistent — England, for example, gets no
// Conference League tag at all because that berth is awarded through the cup
// pathway and cascades down the table. In practice the cup winners are almost
// always already qualified via league position, so the Europa / Conference
// spots fall to the positions below. This map encodes that usual table outcome
// (2025-26 UEFA allocation) so the indicators are clear and consistent.

import type { StandingsGroup, StandingRow } from "./standings";

export type LeagueZones = {
  ucl: [number, number]; // Champions League band (inclusive ranks)
  uel: number[]; // Europa League ranks
  uecl: number[]; // Conference League ranks
  releg: [number, number]; // automatic relegation band
  topLabel: string;
};

const EURO: Record<string, LeagueZones> = {
  // England earns a 5th UCL berth from its UEFA coefficient; FA Cup → Europa,
  // EFL Cup → Conference, both of which cascade, so 6th/7th usually get Europe.
  "eng.1": { ucl: [1, 5], uel: [6], uecl: [7], releg: [18, 20], topLabel: "UCL" },
  "esp.1": { ucl: [1, 4], uel: [5], uecl: [6], releg: [18, 20], topLabel: "UCL" },
  "ita.1": { ucl: [1, 4], uel: [5], uecl: [6], releg: [18, 20], topLabel: "UCL" },
  // Bundesliga & Ligue 1 are 18 teams: 17-18 auto down, 16th plays a play-off.
  "ger.1": { ucl: [1, 4], uel: [5], uecl: [6], releg: [17, 18], topLabel: "UCL" },
  "fra.1": { ucl: [1, 3], uel: [4], uecl: [5], releg: [17, 18], topLabel: "UCL" },
};

const NOTE = {
  ucl: { color: "#3b82f6", text: "Champions League" },
  uel: { color: "#f59e0b", text: "Europa League" },
  uecl: { color: "#22d3ee", text: "Conference League" },
  releg: { color: "#f87171", text: "Relegation" },
};

const inBand = (rank: number, [lo, hi]: [number, number]) =>
  rank >= lo && rank <= hi;

export function leagueZones(slug: string): LeagueZones | null {
  return EURO[slug] ?? null;
}

// Paint qualification-zone notes onto a positional table (overrides ESPN's
// patchy notes for the leagues we know). Only meaningful once games are played.
export function applyZoneNotes(
  slug: string,
  groups: StandingsGroup[]
): StandingsGroup[] {
  const z = EURO[slug];
  if (!z) return groups;
  return groups.map((g) => ({
    ...g,
    rows: g.rows.map((r): StandingRow => {
      let note: StandingRow["note"];
      if (inBand(r.rank, z.ucl)) note = NOTE.ucl;
      else if (z.uel.includes(r.rank)) note = NOTE.uel;
      else if (z.uecl.includes(r.rank)) note = NOTE.uecl;
      else if (inBand(r.rank, z.releg)) note = NOTE.releg;
      return { ...r, note };
    }),
  }));
}

export type ZoneCounts = {
  uclSpots: number;
  uelSpots: number;
  ueclSpots: number;
  relegSpots: number;
  topLabel: string;
};

// Spot counts straight from the config — works pre-season (no games / no notes).
export function zoneCounts(slug: string): ZoneCounts | null {
  const z = EURO[slug];
  if (!z) return null;
  return {
    uclSpots: z.ucl[1] - z.ucl[0] + 1,
    uelSpots: z.uel.length,
    ueclSpots: z.uecl.length,
    relegSpots: z.releg[1] - z.releg[0] + 1,
    topLabel: z.topLabel,
  };
}
