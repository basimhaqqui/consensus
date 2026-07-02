// League season projection: assemble the remaining fixtures from ESPN and
// Monte-Carlo the rest of the season to estimate each team's title / European
// qualification / relegation odds and projected points.

import { forecast } from "./model";
import { getStandings, ratingMap, type StandingRow } from "./standings";

export type RemFixture = { home: string; away: string };

const fmt = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");

// Ratings from the prior season's final table (for pre-season projections).
export async function priorSeasonRatings(
  slug: string,
  year: number
): Promise<Map<string, number>> {
  const g = await getStandings(slug, year);
  return g ? ratingMap(g) : new Map();
}

export async function getRemainingFixtures(
  slug: string,
  months = 6
): Promise<RemFixture[]> {
  const now = new Date();
  const ranges: string[] = [];
  for (let i = 0; i < months; i++) {
    const s = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1));
    const e = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i + 1, 0));
    ranges.push(`${fmt(s)}-${fmt(e)}`);
  }

  const results = await Promise.all(
    ranges.map((r) =>
      fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${r}`,
        { next: { revalidate: 1800 } }
      )
        .then((x) => (x.ok ? x.json() : null))
        .catch(() => null)
    )
  );

  const seen = new Set<string>();
  const fixtures: RemFixture[] = [];
  for (const d of results) {
    for (const e of d?.events ?? []) {
      if (seen.has(e.id)) continue;
      if (e.status?.type?.state !== "pre") continue;
      seen.add(e.id);
      const cs = e.competitions?.[0]?.competitors ?? [];
      const h = cs.find((c: any) => c.homeAway === "home");
      const a = cs.find((c: any) => c.homeAway === "away");
      if (h?.team?.abbreviation && a?.team?.abbreviation) {
        fixtures.push({ home: h.team.abbreviation, away: a.team.abbreviation });
      }
    }
  }
  return fixtures;
}

// Qualification structure from ESPN's standings notes (spot counts + label).
export function qualStructure(rows: StandingRow[]) {
  let uclSpots = 0;
  let relegSpots = 0;
  let lib = false;
  let ucl = false;
  for (const r of rows) {
    const t = (r.note?.text ?? "").toLowerCase();
    if (/relegation/.test(t)) relegSpots++;
    if (/champions|libertadores/.test(t)) {
      uclSpots++;
      if (/libertadores/.test(t)) lib = true;
      if (/champions/.test(t)) ucl = true;
    }
  }
  const topLabel = lib ? "LIB" : ucl ? "UCL" : "EUR";
  // uel/uecl aren't reliably tagged by ESPN — left at 0 for the fallback path
  // (config-driven leagues supply these via zoneCounts instead).
  return { uclSpots, uelSpots: 0, ueclSpots: 0, relegSpots, topLabel };
}

export type ProjRow = {
  abbr: string;
  name: string;
  logo?: string;
  title: number;
  ucl: number;
  uecl: number;
  releg: number;
  projPts: number;
};

export function projectSeason(
  rows: StandingRow[],
  ratings: Map<string, number>,
  fixtures: RemFixture[],
  opts: { uclSpots: number; uelSpots: number; ueclSpots: number; relegSpots: number },
  iters = 3000,
  useCurrentPoints = true
): ProjRow[] {
  // precompute each remaining fixture's outcome probabilities once
  const fx = fixtures
    .map((f) => {
      const rh = ratings.get(f.home);
      const ra = ratings.get(f.away);
      if (rh == null || ra == null) return null;
      const o = forecast(rh + 50, ra); // small home edge
      return { home: f.home, away: f.away, pH: o.pHome, pHD: o.pHome + o.pDraw };
    })
    .filter(Boolean) as { home: string; away: string; pH: number; pHD: number }[];

  const teams = rows.map((r) => r.abbr);
  const basePts: Record<string, number> = {};
  const baseGd: Record<string, number> = {};
  rows.forEach((r) => {
    basePts[r.abbr] = useCurrentPoints ? r.pts : 0;
    baseGd[r.abbr] = useCurrentPoints ? r.gd : 0;
  });

  const title: Record<string, number> = {};
  const ucl: Record<string, number> = {};
  const uecl: Record<string, number> = {};
  const releg: Record<string, number> = {};
  const ptsSum: Record<string, number> = {};
  teams.forEach((t) => {
    title[t] = ucl[t] = uecl[t] = releg[t] = ptsSum[t] = 0;
  });

  // Conference League sits below the UCL + Europa bands in the final order.
  const ueclStart = opts.uclSpots + opts.uelSpots;

  for (let i = 0; i < iters; i++) {
    const pts: Record<string, number> = { ...basePts };
    for (const f of fx) {
      const r = Math.random();
      if (r < f.pH) pts[f.home] += 3;
      else if (r < f.pHD) {
        pts[f.home] += 1;
        pts[f.away] += 1;
      } else pts[f.away] += 3;
    }
    const order = [...teams].sort(
      (a, b) => pts[b] - pts[a] || baseGd[b] - baseGd[a] || Math.random() - 0.5
    );
    title[order[0]]++;
    for (let k = 0; k < opts.uclSpots && k < order.length; k++) ucl[order[k]]++;
    for (
      let k = ueclStart;
      k < ueclStart + opts.ueclSpots && k < order.length;
      k++
    )
      uecl[order[k]]++;
    for (let k = 0; k < opts.relegSpots && k < order.length; k++)
      releg[order[order.length - 1 - k]]++;
    teams.forEach((t) => (ptsSum[t] += pts[t]));
  }

  return rows
    .map((r) => ({
      abbr: r.abbr,
      name: r.name,
      logo: r.logo,
      title: title[r.abbr] / iters,
      ucl: ucl[r.abbr] / iters,
      uecl: uecl[r.abbr] / iters,
      releg: releg[r.abbr] / iters,
      projPts: ptsSum[r.abbr] / iters,
    }))
    .sort((a, b) => b.title - a.title || b.projPts - a.projPts);
}
