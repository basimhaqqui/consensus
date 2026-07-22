// Standings/tables for any competition (league table, or World Cup groups),
// plus a form-based power rating derived from the table so our forecast model
// generalises beyond the World Cup.

export type StandingRow = {
  id?: string;
  name: string;
  abbr: string;
  logo?: string;
  rank: number;
  gp: number;
  w: number;
  d: number;
  l: number;
  gf: number;
  ga: number;
  gd: number;
  pts: number;
  note?: { color: string; text: string }; // qualification zone (UCL, relegation…)
};

export type StandingsGroup = { name: string; rows: StandingRow[] };

const numOf = (m: Record<string, any>, k: string) => {
  const v = m[k];
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isNaN(n) ? 0 : n;
};

export async function getStandings(
  slug: string,
  season?: number
): Promise<StandingsGroup[] | null> {
  const url = `https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings${
    season ? `?season=${season}` : ""
  }`;
  let d: any;
  try {
    const r = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) return null;
    d = await r.json();
  } catch {
    return null;
  }

  const children = d.children?.length ? d.children : [d];
  const groups: StandingsGroup[] = children
    .map((g: any): StandingsGroup | null => {
      const entries = g.standings?.entries ?? [];
      if (!entries.length) return null;
      const rows: StandingRow[] = entries.map((e: any) => {
        const m: Record<string, any> = {};
        (e.stats ?? []).forEach((s: any) => {
          m[s.name] = s.value ?? s.displayValue;
        });
        const note = e.note
          ? {
              color: String(e.note.color ?? "#888").replace(/^#+/, "#"),
              text: e.note.description ?? e.note.headline ?? "",
            }
          : undefined;
        return {
          id: e.team?.id ? String(e.team.id) : undefined,
          name: e.team?.displayName ?? "",
          abbr: e.team?.abbreviation ?? "",
          logo: e.team?.logos?.[0]?.href ?? e.team?.logo,
          note,
          rank: numOf(m, "rank"),
          gp: numOf(m, "gamesPlayed"),
          w: numOf(m, "wins"),
          d: numOf(m, "ties"),
          l: numOf(m, "losses"),
          gf: numOf(m, "pointsFor"),
          ga: numOf(m, "pointsAgainst"),
          gd: numOf(m, "pointDifferential"),
          pts: numOf(m, "points"),
        };
      });
      rows.sort((a, b) => a.rank - b.rank);
      return { name: g.name ?? g.abbreviation ?? "Table", rows };
    })
    .filter((g: StandingsGroup | null): g is StandingsGroup => g !== null);

  return groups.length ? groups : null;
}

// Form-based power rating from a table row (Elo-ish scale for our model).
// Needs a few games played to be meaningful.
// Slopes are on the log-link scale (300 Elo = 1.0 of log-goal supremacy — see
// lib/model.ts); they express the same team spread the old 163/58 did at /210.
export function ratingFromRow(r: StandingRow): number | null {
  if (r.gp < 3) return null;
  const gdpg = r.gd / r.gp;
  const ppg = r.pts / r.gp;
  return Math.round(1700 + 233 * gdpg + 83 * (ppg - 1.4));
}

// Build a rating lookup (by abbreviation) across all groups of a competition.
export function ratingMap(groups: StandingsGroup[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const g of groups) {
    for (const row of g.rows) {
      const rating = ratingFromRow(row);
      if (rating !== null && row.abbr) map.set(row.abbr, rating);
    }
  }
  return map;
}
