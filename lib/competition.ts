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

const per90 = (value: number, minutes: number) =>
  minutes > 0 ? (value * 90) / minutes : 0;

function rawImpact(player: CompetitionPlayerStats) {
  const minutes = Math.max(player.minutes, 1);
  const ratingBase = Math.max(0, player.rating - 6) * 12;
  const goals90 = per90(player.goals, minutes);
  const assists90 = per90(player.assists, minutes);
  const chances90 = per90(player.keyPasses, minutes);
  const shotsOn90 = per90(player.shotsOnTarget, minutes);
  const tackles90 = per90(player.tackles, minutes);
  const interceptions90 = per90(player.interceptions, minutes);
  const blocks90 = per90(player.blocks, minutes);
  const duelsWon90 = per90(player.duelsWon, minutes);
  const dribbles90 = per90(player.dribblesWon, minutes);
  const saves90 = per90(player.saves, minutes);
  const cleanRate = player.appearances ? player.cleanSheets / player.appearances : 0;
  const concededRate = player.appearances ? player.conceded / player.appearances : 0;

  if (player.position === "Attacker") {
    return ratingBase + goals90 * 24 + assists90 * 17 + chances90 * 2.8 + shotsOn90 * 2.2 + dribbles90 * 1.4;
  }
  if (player.position === "Midfielder") {
    return ratingBase + goals90 * 14 + assists90 * 18 + chances90 * 3.2 + tackles90 * 1.1 + interceptions90 * 1.8 + duelsWon90 * 0.45 + dribbles90 * 1.1 + Math.max(0, player.passAccuracy - 72) * 0.16;
  }
  if (player.position === "Defender") {
    return ratingBase + cleanRate * 12 + tackles90 * 1.9 + interceptions90 * 2.6 + blocks90 * 2.4 + duelsWon90 * 0.8 + chances90 * 1.2 + Math.max(0, player.passAccuracy - 72) * 0.18;
  }
  return ratingBase + cleanRate * 24 + saves90 * 2.4 - concededRate * 3 + player.penaltiesSaved * 5;
}

function recalibratePlayers(source: CompetitionPlayerStats[]) {
  const calibrated = source.map((player) => ({ ...player }));
  const rawByKey = new Map(calibrated.map((player) => [player.key, rawImpact(player)]));
  const roles = ["Attacker", "Midfielder", "Defender", "Goalkeeper"];

  for (const role of roles) {
    const rolePlayers = calibrated
      .filter((player) => player.position === role && player.minutes >= 180)
      .sort((a, b) =>
        (rawByKey.get(b.key) ?? 0) - (rawByKey.get(a.key) ?? 0) ||
        b.rating - a.rating ||
        b.minutes - a.minutes
      );
    if (rolePlayers.length === 0) continue;
    const rawValues = rolePlayers.map((player) => rawByKey.get(player.key) ?? 0);
    const minRaw = Math.min(...rawValues);
    const maxRaw = Math.max(...rawValues);
    const spread = Math.max(maxRaw - minRaw, 1);

    rolePlayers.forEach((player, index) => {
      const rawPercentile =
        ((rawByKey.get(player.key) ?? minRaw) - minRaw) / spread;
      const rankPercentile =
        rolePlayers.length === 1 ? 1 : 1 - index / (rolePlayers.length - 1);
      const roleScore =
        60 + (rawPercentile * 0.55 + rankPercentile * 0.45) * 38;
      const ratingScore = Math.max(
        60,
        Math.min(98, 60 + (player.rating - 6) * 11.8)
      );
      player.roleRank = index + 1;
      player.impact = Number(
        (roleScore * 0.7 + ratingScore * 0.3).toFixed(1)
      );
    });
  }

  calibrated
    .filter((player) => player.minutes >= 180)
    .sort((a, b) =>
      b.impact - a.impact ||
      (rawByKey.get(b.key) ?? 0) - (rawByKey.get(a.key) ?? 0) ||
      b.rating - a.rating ||
      b.minutes - a.minutes
    )
    .forEach((player, index) => {
      player.overallRank = index + 1;
    });

  return calibrated;
}

const players = recalibratePlayers(snapshot.players);
const byId = new Map(players.map((player) => [player.id, player]));

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
  return players.find((player) => {
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
) => players.filter(filter).sort(sorter).slice(0, limit);

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
