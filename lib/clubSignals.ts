import { cache } from "react";
import { leagueRatings, CLUBELO_SLUGS } from "./clubelo";
import {
  COMPETITIONS,
  competitionBySlug,
  getLeagueScoreboard,
  type Competition,
  type LeagueMatch,
} from "./leagues";
import { clubRatingGap, forecastClub, inPlay } from "./model";
import { getStandings } from "./standings";

const SIGNAL_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
const RECENT_LIVE_GRACE_MS = 8 * 60 * 60 * 1000;

export type ClubSignalSide = {
  name: string;
  code: string;
  logo?: string;
};

export type ClubSignal = {
  id: string;
  league: string;
  matchId: string;
  competition: string;
  competitionShort: string;
  destination: string;
  sharePath: string;
  status: LeagueMatch["status"];
  date: string;
  meta: string;
  left: ClubSignalSide;
  right: ClubSignalSide;
  pickSide: "left" | "right";
  pickName: string;
  opponentName: string;
  homeProbability: number;
  awayProbability: number;
  probability: number;
  drawProbability: number;
  lambdaHome: number;
  lambdaAway: number;
  priority: number;
  reasons: [string, string];
};

export type ClubSignalFeed = {
  signals: ClubSignal[];
  feedsOnline: number;
  competitionsChecked: number;
};

const CLUB_COMPETITIONS = COMPETITIONS.filter(
  (competition) => competition.slug !== "fifa.world"
);

export const getClubSignalFeed = cache(async (): Promise<ClubSignalFeed> => {
  const boards = await Promise.all(
    CLUB_COMPETITIONS.map(async (competition) => ({
      competition,
      board: await getLeagueScoreboard(competition.slug),
    }))
  );
  const now = Date.now();
  const active = boards
    .map(({ competition, board }) => ({
      competition,
      matches: (board?.matches ?? []).filter((match) => inSignalWindow(match, now)),
    }))
    .filter(({ matches }) => matches.length > 0);

  const groups = await Promise.all(
    active.map(({ competition, matches }) =>
      buildCompetitionSignals(competition, matches, now)
    )
  );

  return {
    signals: groups.flat().sort(rankSignals),
    feedsOnline: boards.filter(({ board }) => board !== null).length,
    competitionsChecked: CLUB_COMPETITIONS.length,
  };
});

export const getClubSignal = cache(
  async (id: string): Promise<ClubSignal | null> => {
    const decoded = decodeClubSignalId(id);
    if (!decoded) return null;
    const competition = competitionBySlug(decoded.league);
    if (!competition || competition.slug === "fifa.world") return null;

    const board = await getLeagueScoreboard(decoded.league);
    const match = board?.matches.find((item) => item.id === decoded.matchId);
    if (!match || match.status === "post") return null;

    const signals = await buildCompetitionSignals(
      competition,
      [match],
      Date.now()
    );
    return signals[0] ?? null;
  }
);

export function clubSignalId(league: string, matchId: string) {
  return `club_${league}_${matchId}`;
}

function decodeClubSignalId(id: string) {
  const match = id.match(/^club_([^_]+)_([^_]+)$/);
  return match ? { league: match[1], matchId: match[2] } : null;
}

async function buildCompetitionSignals(
  competition: Competition,
  matches: LeagueMatch[],
  now: number
): Promise<ClubSignal[]> {
  const standings = await getStandings(competition.slug);
  const ratings = await leagueRatings(competition.slug, standings);
  if (ratings.size < 2) return [];

  return matches.flatMap((match) => {
    const ratingHome = ratings.get(match.home.abbr);
    const ratingAway = ratings.get(match.away.abbr);
    if (ratingHome === undefined || ratingAway === undefined) return [];

    const outcome = forecastClub(ratingHome, ratingAway);
    const probabilities = liveProbabilities(match, outcome);
    const pickLeft = probabilities.pHome >= probabilities.pAway;
    const pick = pickLeft ? match.home : match.away;
    const opponent = pickLeft ? match.away : match.home;
    const probability = pickLeft ? probabilities.pHome : probabilities.pAway;
    const ratingGap = Math.abs(clubRatingGap(ratingHome, ratingAway));
    const xgEdge = pickLeft
      ? outcome.lambdaHome - outcome.lambdaAway
      : outcome.lambdaAway - outcome.lambdaHome;
    const id = clubSignalId(competition.slug, match.id);
    const source = CLUBELO_SLUGS.has(competition.slug)
      ? "ClubElo strength"
      : "current table form";

    return [{
      id,
      league: competition.slug,
      matchId: match.id,
      competition: competition.name,
      competitionShort: competition.short,
      destination: `/m/${competition.slug}/${match.id}`,
      sharePath: `/signal/football/${id}`,
      status: match.status,
      date: match.status === "in" ? `Live · ${match.detail}` : formatKickoff(match.dateISO),
      meta: `${source} · ${match.status === "in" ? "in-play" : "model only"}`,
      left: side(match.home),
      right: side(match.away),
      pickSide: pickLeft ? "left" : "right",
      pickName: pick.name,
      opponentName: opponent.name,
      homeProbability: probabilities.pHome,
      awayProbability: probabilities.pAway,
      probability,
      drawProbability: probabilities.pDraw,
      lambdaHome: outcome.lambdaHome,
      lambdaAway: outcome.lambdaAway,
      priority: probability * 0.7 + relevance(match, now) * 0.3,
      reasons: [
        `${pick.name} has the strongest 90-minute result probability at ${pct(
          probability
        )}; the draw remains ${pct(probabilities.pDraw)}.`,
        `${source} produces a ${Math.round(ratingGap)}-point adjusted rating edge and a ${Math.abs(
          xgEdge
        ).toFixed(1)} expected-goal advantage.`,
      ],
    } satisfies ClubSignal];
  });
}

function liveProbabilities(
  match: LeagueMatch,
  outcome: ReturnType<typeof forecastClub>
) {
  if (
    match.status === "in" &&
    match.minute !== undefined &&
    match.home.score !== undefined &&
    match.away.score !== undefined
  ) {
    return inPlay(
      outcome.lambdaHome,
      outcome.lambdaAway,
      Number(match.home.score),
      Number(match.away.score),
      Math.max(1, 90 - match.minute)
    );
  }
  return outcome;
}

function inSignalWindow(match: LeagueMatch, now: number) {
  if (match.status === "in") return true;
  if (match.status !== "pre") return false;
  const kickoff = Date.parse(match.dateISO);
  return (
    Number.isFinite(kickoff) &&
    kickoff >= now - RECENT_LIVE_GRACE_MS &&
    kickoff <= now + SIGNAL_WINDOW_MS
  );
}

function relevance(match: LeagueMatch, now: number) {
  if (match.status === "in") return 1;
  const hours = Math.max(0, (Date.parse(match.dateISO) - now) / 3_600_000);
  if (hours <= 24) return 0.92;
  if (hours <= 72) return 0.76;
  if (hours <= 168) return 0.58;
  return 0.4;
}

function rankSignals(a: ClubSignal, b: ClubSignal) {
  return b.priority - a.priority || b.probability - a.probability;
}

function side(team: LeagueMatch["home"]): ClubSignalSide {
  return {
    name: team.name,
    code: team.abbr || team.name.slice(0, 3).toUpperCase(),
    logo: team.logo,
  };
}

function pct(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatKickoff(dateISO: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(dateISO));
}
