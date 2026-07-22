import { CLUBELO_SLUGS } from "./clubelo";
import {
  getRemainingFixtures,
  priorSeasonRatings,
  projectSeason,
  qualStructure,
  type ProjRow,
} from "./projection";
import { zoneCounts } from "./qualification";
import type { StandingRow, StandingsGroup } from "./standings";

export type LeagueProjection = {
  rows: ProjRow[];
  showUcl: boolean;
  showUecl: boolean;
  showReleg: boolean;
  topLabel: string;
  label: string;
};

export async function buildConferenceProjections(
  slug: string,
  groups: StandingsGroup[],
  ratings: Map<string, number>
): Promise<{ name: string; rows: ProjRow[] }[]> {
  const fixtures = await getRemainingFixtures(slug, 6);
  if (fixtures.length < 1) return [];
  const out: { name: string; rows: ProjRow[] }[] = [];
  for (const group of groups) {
    const maxGp = Math.max(0, ...group.rows.map((row) => row.gp));
    if (maxGp === 0) continue;
    const playoffSpots =
      group.rows.filter((row) => /playoff|wild card/i.test(row.note?.text ?? ""))
        .length || 9;
    const rows = projectSeason(
      group.rows,
      ratings,
      fixtures,
      { uclSpots: playoffSpots, uelSpots: 0, ueclSpots: 0, relegSpots: 0 },
      3_000,
      true
    );
    if (rows.length) out.push({ name: group.name, rows });
  }
  return out;
}

export async function buildProjection(
  slug: string,
  rows: StandingRow[],
  ratingMap: Map<string, number>,
  realRatings = CLUBELO_SLUGS.has(slug) &&
    ratingMap.size >= rows.length * 0.7
): Promise<LeagueProjection | null> {
  const fullSeason = 2 * (rows.length - 1);
  const maxGp = Math.max(...rows.map((row) => row.gp), 0);
  let ratings = ratingMap;
  let useCurrent = true;
  let label = "Season projection — our model";

  const now = new Date();
  const priorYear = now.getUTCMonth() >= 6
    ? now.getUTCFullYear() - 1
    : now.getUTCFullYear() - 2;

  if (maxGp === 0) {
    if (!realRatings) ratings = await priorSeasonRatings(slug, priorYear);
    useCurrent = false;
    label = "Title race — projected season";
  } else if (maxGp >= fullSeason) {
    useCurrent = false;
    label = "Title race — next season";
  } else {
    const prior = realRatings
      ? new Map<string, number>()
      : await priorSeasonRatings(slug, priorYear);
    if (prior.size) {
      const blended = new Map<string, number>();
      for (const row of rows) {
        const current = ratingMap.get(row.abbr);
        const previous = prior.get(row.abbr);
        if (current != null && previous != null) {
          const weight = row.gp / (row.gp + 10);
          blended.set(
            row.abbr,
            Math.round(weight * current + (1 - weight) * previous)
          );
        } else if (current != null) blended.set(row.abbr, current);
        else if (previous != null) blended.set(row.abbr, previous);
      }
      ratings = blended;
    }
  }

  if (ratings.size < 4) return null;
  const fixtures = await getRemainingFixtures(slug, useCurrent ? 6 : 12);
  if (fixtures.length < 1) return null;
  const structure = zoneCounts(slug) ?? qualStructure(rows);
  const projected = projectSeason(
    rows,
    ratings,
    fixtures,
    structure,
    3_000,
    useCurrent
  );
  if (!projected.length) return null;
  return {
    rows: projected,
    showUcl: structure.uclSpots > 0,
    showUecl: structure.ueclSpots > 0,
    showReleg: structure.relegSpots > 0,
    topLabel: structure.topLabel,
    label,
  };
}
