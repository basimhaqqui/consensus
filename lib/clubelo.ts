// Real club strength from clubelo.com's free API — a results-based Elo over
// every European club, updated after each match. Replaces the table-form
// regression for European competitions: it survives the off-season (no dead
// pre-season projections), tracks strength through the season, and makes
// cross-league comparisons (UCL/UEL) meaningful. Values land on the same
// scale our goals link was fitted to (top clubs ~2000, strugglers ~1500),
// so no rescaling. The Americas aren't covered — MLS and Brazil keep the
// form-based ratings.

import { ratingMap, type StandingsGroup } from "./standings";

type EloRow = { club: string; norm: string; tokens: Set<string>; elo: number };

// ClubElo uses short names; ESPN uses long ones. Aliases cover the pairs
// token matching can't bridge (keys are normalized ESPN names).
const ALIAS: Record<string, string> = {
  "manchester city": "man city",
  "manchester united": "man united",
  "deportivo la coruna": "depor",
  "fc cologne": "koeln",
  "wolverhampton wanderers": "wolves",
  "nottingham forest": "forest",
  "brighton hove albion": "brighton",
  "west ham united": "west ham",
  "tottenham hotspur": "tottenham",
  internazionale: "inter",
  "ac milan": "milan",
  "as roma": "roma",
  "atletico madrid": "atletico",
  "athletic club": "bilbao",
  "real sociedad": "sociedad",
  "real betis": "betis",
  "celta vigo": "celta",
  "deportivo alaves": "alaves",
  "paris saint germain": "paris sg",
  "bayern munich": "bayern",
  "borussia dortmund": "dortmund",
  "bayer leverkusen": "leverkusen",
  "borussia monchengladbach": "gladbach",
  "eintracht frankfurt": "frankfurt",
  "vfb stuttgart": "stuttgart",
  "vfl wolfsburg": "wolfsburg",
  "1 fc union berlin": "union berlin",
  "1 fc koln": "koeln",
  "1 fsv mainz 05": "mainz",
  "tsg hoffenheim": "hoffenheim",
  "sc freiburg": "freiburg",
  "werder bremen": "werder",
  "fc augsburg": "augsburg",
  "fc st pauli": "st pauli",
  "as monaco": "monaco",
  "olympique lyonnais": "lyon",
  "olympique marseille": "marseille",
  "stade rennais": "rennes",
  "stade brestois 29": "brest",
  "rc lens": "lens",
  "losc lille": "lille",
  "ogc nice": "nice",
  "rc strasbourg": "strasbourg",
  "toulouse fc": "toulouse",
  "fc nantes": "nantes",
  "aj auxerre": "auxerre",
  "le havre ac": "le havre",
  "angers sco": "angers",
  "sporting cp": "sporting",
};

const strip = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const NOISE = new Set(["fc", "afc", "cf", "ac", "club", "de", "cd", "sc"]);
const tokens = (s: string) =>
  new Set(strip(s).split(" ").filter((t) => t && !NOISE.has(t)));

// today's full ranking, cached a day (the URL carries the date, so the cache
// key rolls over naturally)
async function fetchTable(): Promise<EloRow[]> {
  const day = new Date().toISOString().slice(0, 10);
  try {
    const res = await fetch(`http://api.clubelo.com/${day}`, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return [];
    const csv = await res.text();
    const rows: EloRow[] = [];
    for (const line of csv.split("\n").slice(1)) {
      const [, club, , , elo] = line.split(",");
      if (!club || !elo) continue;
      rows.push({
        club,
        norm: strip(club),
        tokens: tokens(club),
        elo: Math.round(Number(elo)),
      });
    }
    return rows;
  } catch {
    return [];
  }
}

function subset(a: Set<string>, b: Set<string>) {
  for (const t of a) if (!b.has(t)) return false;
  return a.size > 0;
}

function lookup(table: EloRow[], espnName: string): number | null {
  const norm = strip(espnName);
  const aliased = ALIAS[norm];
  if (aliased) {
    const hit = table.find((r) => r.norm === aliased);
    if (hit) return hit.elo;
  }
  const exact = table.find((r) => r.norm === norm);
  if (exact) return exact.elo;
  // unique token containment either way ("Man City" ⊂ "Manchester City" fails
  // on tokens, but "Girona" ⊂ "Girona FC" and "Como" ⊂ "Como 1907" hit)
  const mine = tokens(espnName);
  const hits = table.filter(
    (r) => subset(r.tokens, mine) || subset(mine, r.tokens)
  );
  return hits.length === 1 ? hits[0].elo : null;
}

// Ratings keyed by ESPN abbreviation for every standings row we can match.
export async function clubEloRatings(
  groups: StandingsGroup[]
): Promise<Map<string, number>> {
  const table = await fetchTable();
  const map = new Map<string, number>();
  if (!table.length) return map;
  for (const g of groups) {
    for (const row of g.rows) {
      if (!row.abbr) continue;
      const elo = lookup(table, row.name);
      if (elo !== null) map.set(row.abbr, elo);
    }
  }
  return map;
}

// One-stop rating map for a competition: form ratings as the floor, ClubElo
// on top wherever it matches (European competitions only).
export async function leagueRatings(
  slug: string,
  groups: StandingsGroup[] | null
): Promise<Map<string, number>> {
  const map = groups ? ratingMap(groups) : new Map<string, number>();
  if (groups && CLUBELO_SLUGS.has(slug)) {
    const elo = await clubEloRatings(groups);
    for (const [k, v] of elo) map.set(k, v);
  }
  return map;
}

// Competitions ClubElo covers (European clubs).
export const CLUBELO_SLUGS = new Set([
  "eng.1",
  "esp.1",
  "ita.1",
  "ger.1",
  "fra.1",
  "uefa.champions",
  "uefa.europa",
  "uefa.europa.conf",
]);
