import "server-only";
import { cache } from "react";
import {
  fetchClubMarketOdds,
  findClubMarketLine,
  type ClubMarketLine,
} from "./clubOdds";
import { leagueRatings } from "./clubelo";
import {
  buildConferenceProjections,
  buildProjection,
} from "./leagueProjection";
import {
  competitionBySlug,
  getClubSchedule,
  getLeagueScoreboard,
  type LeagueMatch,
} from "./leagues";
import { forecastClub, type Outcome } from "./model";
import { applyZoneNotes } from "./qualification";
import { getStandings, type StandingRow, type StandingsGroup } from "./standings";

export type ClubPlayer = {
  id: string;
  name: string;
  shortName: string;
  headshot?: string;
  jersey?: string;
  position: string;
  age?: number;
  nationality?: string;
  appearances: number;
  goals: number;
  assists: number;
  shotsOnTarget: number;
  saves: number;
};

export type ClubAvailability = {
  playerId: string;
  player: string;
  headshot?: string;
  status: string;
  detail?: string;
};

export type ClubIdentity = {
  id: string;
  abbr: string;
  name: string;
  shortName: string;
  logo?: string;
  color: string;
  alternateColor: string;
  standingSummary?: string;
  recordSummary?: string;
};

export type ClubFixtureForecast = {
  match: LeagueMatch;
  outcome: Outcome;
  market: ClubMarketLine | null;
  teamSide: "home" | "away";
  opponent: LeagueMatch["home"];
  modelProbability: number;
  marketProbability?: number;
  consensusProbability: number;
};

export type ClubProjectionSummary = {
  label: string;
  titleLabel: string;
  topLabel: string;
  title: number;
  qualify: number;
  uecl: number;
  relegation: number;
  projectedPoints: number;
};

export type ClubPageData = {
  league: string;
  competition: string;
  competitionShort: string;
  season?: string;
  team: ClubIdentity;
  row: StandingRow | null;
  tableGroup: StandingsGroup | null;
  tableWindow: StandingRow[];
  rating?: number;
  recent: LeagueMatch[];
  upcoming: LeagueMatch[];
  form: Array<"W" | "D" | "L">;
  forecasts: ClubFixtureForecast[];
  projection: ClubProjectionSummary | null;
  leaders: ClubPlayer[];
  rosterCount: number;
  availability: ClubAvailability[];
};

type ClubTeamFeed = {
  identity: ClubIdentity;
  players: ClubPlayer[];
  availability: ClubAvailability[];
};

export const getClubPageData = cache(
  async (league: string, requestedAbbr: string): Promise<ClubPageData | null> => {
    const competition = competitionBySlug(league);
    if (!competition || competition.slug === "fifa.world") return null;
    const abbr = requestedAbbr.toUpperCase();

    const [board, rawStandings, marketEvents] = await Promise.all([
      getLeagueScoreboard(league),
      getStandings(league),
      fetchClubMarketOdds(league),
    ]);
    const rawGroup = rawStandings?.find((group) =>
      group.rows.some((row) => row.abbr.toUpperCase() === abbr)
    );
    const rawRow = rawGroup?.rows.find(
      (row) => row.abbr.toUpperCase() === abbr
    );
    const boardSide = board?.matches
      .flatMap((match) => [match.home, match.away])
      .find((side) => side.abbr.toUpperCase() === abbr);
    const teamId = rawRow?.id ?? boardSide?.id;
    if (!teamId || (!rawRow && !boardSide)) return null;

    const standings = rawStandings
      ? applyZoneNotes(league, rawStandings)
      : null;
    const tableGroup = standings?.find((group) =>
      group.rows.some((row) => row.abbr.toUpperCase() === abbr)
    ) ?? null;
    const row = tableGroup?.rows.find(
      (item) => item.abbr.toUpperCase() === abbr
    ) ?? rawRow ?? null;

    const ratingsPromise = leagueRatings(league, standings);
    const projectionPromise = ratingsPromise.then(async (ratings) => {
      if (!standings?.length || !row) return null;
      if (standings.length > 1) {
        const groups = await buildConferenceProjections(league, standings, ratings);
        const projected = groups
          .flatMap((group) => group.rows)
          .find((item) => item.abbr.toUpperCase() === abbr);
        return projected
          ? {
              label: `${tableGroup?.name ?? "Conference"} projection`,
              titleLabel: "Win conference",
              topLabel: "Make playoffs",
              title: projected.title,
              qualify: projected.ucl,
              uecl: 0,
              relegation: 0,
              projectedPoints: Math.round(projected.projPts),
            }
          : null;
      }
      const projected = await buildProjection(
        league,
        standings[0].rows,
        ratings
      );
      const teamProjection = projected?.rows.find(
        (item) => item.abbr.toUpperCase() === abbr
      );
      return projected && teamProjection
        ? {
            label: projected.label,
            titleLabel: "Win league",
            topLabel: projected.topLabel,
            title: teamProjection.title,
            qualify: teamProjection.ucl,
            uecl: teamProjection.uecl,
            relegation: teamProjection.releg,
            projectedPoints: Math.round(teamProjection.projPts),
          }
        : null;
    });

    const [ratings, schedule, teamFeed, projection] = await Promise.all([
      ratingsPromise,
      getClubSchedule(league, teamId, abbr),
      getClubTeamFeed(
        league,
        teamId,
        abbr,
        rawRow?.name ?? boardSide?.name ?? abbr,
        rawRow?.logo ?? boardSide?.logo
      ),
      projectionPromise,
    ]);

    const recent = schedule
      .filter((match) => match.status === "post")
      .sort((a, b) => b.dateISO.localeCompare(a.dateISO))
      .slice(0, 5);
    const upcoming = schedule
      .filter((match) => match.status !== "post")
      .sort((a, b) => a.dateISO.localeCompare(b.dateISO))
      .slice(0, 5);
    const forecasts = upcoming.slice(0, 3).flatMap((match) => {
      const homeRating = ratings.get(match.home.abbr);
      const awayRating = ratings.get(match.away.abbr);
      if (homeRating === undefined || awayRating === undefined) return [];
      const outcome = forecastClub(homeRating, awayRating);
      const market = match.status === "pre"
        ? findClubMarketLine(
            marketEvents,
            match.home.name,
            match.away.name,
            match.dateISO
          )
        : null;
      const teamSide = match.home.abbr.toUpperCase() === abbr ? "home" : "away";
      const modelProbability = teamSide === "home" ? outcome.pHome : outcome.pAway;
      const marketProbability = market
        ? teamSide === "home"
          ? market.pHome
          : market.pAway
        : undefined;
      const opponent = teamSide === "home" ? match.away : match.home;
      return [{
        match,
        outcome,
        market,
        teamSide,
        opponent,
        modelProbability,
        marketProbability,
        consensusProbability: marketProbability === undefined
          ? modelProbability
          : (modelProbability + marketProbability) / 2,
      } satisfies ClubFixtureForecast];
    });
    const tableWindowStart = row && tableGroup
      ? Math.min(
          Math.max(0, row.rank - 3),
          Math.max(0, tableGroup.rows.length - 5)
        )
      : 0;
    const tableWindow = row && tableGroup
      ? tableGroup.rows.slice(tableWindowStart, tableWindowStart + 5)
      : [];

    return {
      league,
      competition: competition.name,
      competitionShort: competition.short,
      season: board?.season,
      team: teamFeed.identity,
      row,
      tableGroup,
      tableWindow,
      rating: ratings.get(abbr),
      recent,
      upcoming,
      form: recent.slice().reverse().map((match) => resultFor(abbr, match)),
      forecasts,
      projection,
      leaders: teamFeed.players
        .slice()
        .sort(rankPlayers)
        .slice(0, 6),
      rosterCount: teamFeed.players.length,
      availability: teamFeed.availability,
    };
  }
);

const getClubTeamFeed = cache(
  async (
    league: string,
    teamId: string,
    abbr: string,
    fallbackName: string,
    fallbackLogo?: string
  ): Promise<ClubTeamFeed> => {
    const base = `https://site.api.espn.com/apis/site/v2/sports/soccer/${league}/teams/${teamId}`;
    const [teamPayload, rosterPayload] = await Promise.all([
      fetch(base, {
        next: { revalidate: 3_600 },
        signal: AbortSignal.timeout(5_000),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
      fetch(`${base}/roster`, {
        next: { revalidate: 3_600 },
        signal: AbortSignal.timeout(5_000),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ]);
    const team = teamPayload?.team ?? rosterPayload?.team ?? {};
    const identity: ClubIdentity = {
      id: teamId,
      abbr,
      name: team.displayName ?? fallbackName,
      shortName: team.shortDisplayName ?? team.name ?? fallbackName,
      logo: team.logos?.[0]?.href ?? team.logo ?? fallbackLogo,
      color: safeColor(team.color, "18181b"),
      alternateColor: safeColor(team.alternateColor, "34d399"),
      standingSummary: team.standingSummary,
      recordSummary: team.record?.items?.[0]?.summary,
    };

    const players: ClubPlayer[] = (rosterPayload?.athletes ?? []).flatMap(
      (athlete: any) => {
        const id = athlete.id ? String(athlete.id) : "";
        const name = athlete.displayName ?? athlete.fullName ?? "";
        if (!id || !name) return [];
        const stats = playerStats(athlete);
        return [{
          id,
          name,
          shortName: athlete.shortName ?? name,
          headshot: athlete.headshot?.href,
          jersey: athlete.jersey ? String(athlete.jersey) : undefined,
          position:
            athlete.position?.displayName ??
            athlete.position?.abbreviation ??
            "Squad",
          age: typeof athlete.age === "number" ? athlete.age : undefined,
          nationality:
            athlete.citizenship ?? athlete.citizenshipCountry?.abbreviation,
          appearances: stats.appearances ?? 0,
          goals: stats.totalGoals ?? 0,
          assists: stats.goalAssists ?? 0,
          shotsOnTarget: stats.shotsOnTarget ?? 0,
          saves: stats.saves ?? 0,
        }];
      }
    );
    const availability: ClubAvailability[] = (rosterPayload?.athletes ?? [])
      .flatMap((athlete: any) =>
        (athlete.injuries ?? []).map((injury: any) => ({
          playerId: String(athlete.id ?? athlete.displayName ?? "unknown"),
          player: athlete.displayName ?? athlete.fullName ?? "Unknown player",
          headshot: athlete.headshot?.href,
          status:
            injury.status ??
            injury.type?.description ??
            injury.type?.name ??
            "Unavailable",
          detail:
            injury.details?.detail ??
            injury.details?.type ??
            injury.longComment ??
            injury.shortComment,
        }))
      )
      .slice(0, 8);
    return { identity, players, availability };
  }
);

function playerStats(athlete: any): Record<string, number> {
  const stats: Record<string, number> = {};
  for (const category of athlete.statistics?.splits?.categories ?? []) {
    for (const item of category.stats ?? []) {
      if (typeof item.name === "string" && typeof item.value === "number") {
        stats[item.name] = item.value;
      }
    }
  }
  return stats;
}

function rankPlayers(left: ClubPlayer, right: ClubPlayer) {
  return (
    right.goals + right.assists - (left.goals + left.assists) ||
    right.goals - left.goals ||
    right.appearances - left.appearances ||
    right.saves - left.saves
  );
}

function resultFor(abbr: string, match: LeagueMatch): "W" | "D" | "L" {
  const isHome = match.home.abbr.toUpperCase() === abbr;
  const mine = Number(isHome ? match.home.score : match.away.score);
  const theirs = Number(isHome ? match.away.score : match.home.score);
  if (!Number.isFinite(mine) || !Number.isFinite(theirs) || mine === theirs) {
    return "D";
  }
  return mine > theirs ? "W" : "L";
}

function safeColor(value: unknown, fallback: string) {
  const color = typeof value === "string" ? value.replace(/^#/, "") : "";
  return /^[0-9a-f]{6}$/i.test(color) ? color : fallback;
}
