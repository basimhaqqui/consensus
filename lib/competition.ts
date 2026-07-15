import "server-only";
import performanceData from "@/data/football-performance.json";
import type {
  CompetitionMeta,
  CompetitionPerformanceView,
  CompetitionPlayerStats,
} from "./competition-types";

export type {
  CompetitionMeta,
  CompetitionPerformanceView,
  CompetitionPlayerStats,
  LeaderCategory,
} from "./competition-types";

type Snapshot = {
  competition: CompetitionMeta;
  players: CompetitionPlayerStats[];
};

const snapshot = performanceData as Snapshot;
const byId = new Map(snapshot.players.map((player) => [player.id, player]));

const norm = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const lastName = (value: string) => norm(value).split(" ").at(-1) ?? "";

export function competitionStatsForPlayer(
  apiFootballId: number | undefined,
  name: string,
  teamName: string
): CompetitionPlayerStats | undefined {
  if (apiFootballId && byId.has(apiFootballId)) return byId.get(apiFootballId);
  const team = norm(teamName);
  const playerName = norm(name);
  const surname = lastName(name);
  return snapshot.players.find((player) => {
    if (norm(player.teamName) !== team) return false;
    const candidate = norm(player.name);
    return candidate === playerName || lastName(player.name) === surname;
  });
}

const eligible = (player: CompetitionPlayerStats) => player.minutes >= 180;
const top = (
  sorter: (a: CompetitionPlayerStats, b: CompetitionPlayerStats) => number,
  filter: (player: CompetitionPlayerStats) => boolean = eligible,
  limit = 8
) => snapshot.players.filter(filter).sort(sorter).slice(0, limit);

export function getCompetitionPerformance(): CompetitionPerformanceView {
  const ratingTieBreak = (a: CompetitionPlayerStats, b: CompetitionPlayerStats) =>
    b.rating - a.rating || b.minutes - a.minutes;

  return {
    competition: snapshot.competition,
    categories: {
      impact: top((a, b) => a.overallRank - b.overallRank),
      goals: top((a, b) => b.goals - a.goals || ratingTieBreak(a, b)),
      assists: top((a, b) => b.assists - a.assists || ratingTieBreak(a, b)),
      contributions: top(
        (a, b) => b.goalContributions - a.goalContributions || ratingTieBreak(a, b)
      ),
      rating: top((a, b) => b.rating - a.rating || b.minutes - a.minutes),
      chances: top((a, b) => b.keyPasses - a.keyPasses || ratingTieBreak(a, b)),
      cleanSheets: top(
        (a, b) => b.cleanSheets - a.cleanSheets || ratingTieBreak(a, b),
        (player) => eligible(player) && player.position === "Goalkeeper"
      ),
      ballWins: top(
        (a, b) =>
          b.tackles + b.interceptions - (a.tackles + a.interceptions) ||
          ratingTieBreak(a, b)
      ),
      shotsOnTarget: top(
        (a, b) => b.shotsOnTarget - a.shotsOnTarget || ratingTieBreak(a, b)
      ),
      saves: top(
        (a, b) => b.saves - a.saves || ratingTieBreak(a, b),
        (player) => eligible(player) && player.position === "Goalkeeper"
      ),
    },
    roles: {
      Attacker: top(
        (a, b) => a.roleRank - b.roleRank,
        (player) => eligible(player) && player.position === "Attacker",
        5
      ),
      Midfielder: top(
        (a, b) => a.roleRank - b.roleRank,
        (player) => eligible(player) && player.position === "Midfielder",
        5
      ),
      Defender: top(
        (a, b) => a.roleRank - b.roleRank,
        (player) => eligible(player) && player.position === "Defender",
        5
      ),
      Goalkeeper: top(
        (a, b) => a.roleRank - b.roleRank,
        (player) => eligible(player) && player.position === "Goalkeeper",
        5
      ),
    },
  };
}
