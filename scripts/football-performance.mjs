import { writeFileSync } from "node:fs";

const KEY = process.env.APIFOOTBALL_KEY;
const BASE = "https://v3.football.api-sports.io";
const LEAGUE = 1;
const SEASON = 2026;
const OUT = new URL("../data/football-performance.json", import.meta.url);

if (!KEY) throw new Error("APIFOOTBALL_KEY is required");

let nextRequestAt = 0;

async function paceRequest() {
  const scheduledAt = Math.max(Date.now(), nextRequestAt);
  nextRequestAt = scheduledAt + 220;
  const wait = scheduledAt - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
}

async function api(path, attempt = 0) {
  await paceRequest();
  const response = await fetch(`${BASE}${path}`, {
    headers: { "x-apisports-key": KEY },
  });
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  const body = await response.json();
  const errors = body.errors;
  const rateLimited = !Array.isArray(errors) && errors?.rateLimit;
  if (rateLimited && attempt < 5) {
    await new Promise((resolve) => setTimeout(resolve, 5000 * (attempt + 1)));
    return api(path, attempt + 1);
  }
  if (Array.isArray(errors) ? errors.length : errors && Object.keys(errors).length) {
    throw new Error(`${path}: ${JSON.stringify(errors)}`);
  }
  return body;
}

async function mapLimit(items, limit, mapper) {
  const result = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      result[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return result;
}

const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const round = (value, precision = 2) => {
  const scale = 10 ** precision;
  return Math.round(value * scale) / scale;
};

const per90 = (value, minutes) => (minutes > 0 ? (value * 90) / minutes : 0);

function rawImpact(player) {
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

function normalizePlayers(raw, cleanSheets) {
  const players = [];
  const seen = new Set();

  for (const entry of raw) {
    for (const stats of entry.statistics ?? []) {
      if (stats.league?.id !== LEAGUE || stats.league?.season !== SEASON) continue;
      const appearances = number(stats.games?.appearences);
      if (!entry.player?.id || !stats.team?.id || appearances === 0) continue;
      const key = `${entry.player.id}:${stats.team.id}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const minutes = number(stats.games?.minutes);
      const goals = number(stats.goals?.total);
      const assists = number(stats.goals?.assists);
      const tackles = number(stats.tackles?.total);
      const interceptions = number(stats.tackles?.interceptions);
      const blocks = number(stats.tackles?.blocks);
      const position = stats.games?.position ?? "Midfielder";

      players.push({
        key,
        id: entry.player.id,
        name: entry.player.name ?? "—",
        firstName: entry.player.firstname ?? "",
        lastName: entry.player.lastname ?? "",
        photo: entry.player.photo ?? "",
        nationality: entry.player.nationality ?? "",
        age: number(entry.player.age) || null,
        height: entry.player.height ?? null,
        teamId: stats.team.id,
        teamName: stats.team.name ?? "—",
        teamLogo: stats.team.logo ?? "",
        position,
        number: stats.games?.number ?? null,
        appearances,
        starts: number(stats.games?.lineups),
        minutes,
        rating: round(number(stats.games?.rating), 2),
        goals,
        assists,
        goalContributions: goals + assists,
        shots: number(stats.shots?.total),
        shotsOnTarget: number(stats.shots?.on),
        keyPasses: number(stats.passes?.key),
        passes: number(stats.passes?.total),
        passAccuracy: number(stats.passes?.accuracy),
        tackles,
        interceptions,
        blocks,
        defensiveActions: tackles + interceptions + blocks,
        duels: number(stats.duels?.total),
        duelsWon: number(stats.duels?.won),
        dribbles: number(stats.dribbles?.attempts),
        dribblesWon: number(stats.dribbles?.success),
        foulsDrawn: number(stats.fouls?.drawn),
        foulsCommitted: number(stats.fouls?.committed),
        yellowCards: number(stats.cards?.yellow),
        redCards: number(stats.cards?.red) + number(stats.cards?.yellowred),
        saves: number(stats.goals?.saves),
        conceded: number(stats.goals?.conceded),
        cleanSheets: cleanSheets.get(entry.player.id) ?? 0,
        penaltiesSaved: number(stats.penalty?.saved),
        impact: 0,
        roleRank: 0,
        overallRank: 0,
      });
    }
  }

  for (const player of players) player._rawImpact = rawImpact(player);

  for (const role of ["Attacker", "Midfielder", "Defender", "Goalkeeper"]) {
    const eligible = players
      .filter((player) => player.position === role && player.minutes >= 180)
      .sort((a, b) => b._rawImpact - a._rawImpact || b.rating - a.rating || b.minutes - a.minutes);
    eligible.forEach((player, index) => {
      player.roleRank = index + 1;
      const percentile = eligible.length > 1 ? index / (eligible.length - 1) : 0;
      player.impact = Math.round(99 - percentile * 34);
    });
  }

  const overall = players
    .filter((player) => player.minutes >= 180)
    .sort((a, b) => b.impact - a.impact || b.rating - a.rating || b.minutes - a.minutes);
  overall.forEach((player, index) => {
    player.overallRank = index + 1;
  });

  return players.map(({ _rawImpact, ...player }) => player);
}

const firstPage = await api(`/players?league=${LEAGUE}&season=${SEASON}&page=1`);
const pageCount = number(firstPage.paging?.total) || 1;
const remainingPages = Array.from({ length: Math.max(0, pageCount - 1) }, (_, index) => index + 2);
const pageBodies = await mapLimit(remainingPages, 8, (page) =>
  api(`/players?league=${LEAGUE}&season=${SEASON}&page=${page}`)
);
const rawPlayers = [firstPage, ...pageBodies].flatMap((body) => body.response ?? []);

const fixtureBody = await api(`/fixtures?league=${LEAGUE}&season=${SEASON}&status=FT`);
const fixtures = fixtureBody.response ?? [];
const cleanSheetFixtures = fixtures.filter(
  (fixture) => fixture.goals?.home === 0 || fixture.goals?.away === 0
);
const lineupBodies = await mapLimit(cleanSheetFixtures, 8, (fixture) =>
  api(`/fixtures/lineups?fixture=${fixture.fixture.id}`)
);
const cleanSheets = new Map();

cleanSheetFixtures.forEach((fixture, index) => {
  const lineups = lineupBodies[index]?.response ?? [];
  const credit = (teamId) => {
    const lineup = lineups.find((entry) => entry.team?.id === teamId);
    const keeper = lineup?.startXI?.find((entry) => entry.player?.pos === "G")?.player;
    if (keeper?.id) cleanSheets.set(keeper.id, (cleanSheets.get(keeper.id) ?? 0) + 1);
  };
  if (fixture.goals?.away === 0) credit(fixture.teams?.home?.id);
  if (fixture.goals?.home === 0) credit(fixture.teams?.away?.id);
});

const players = normalizePlayers(rawPlayers, cleanSheets);
const snapshot = {
  competition: {
    slug: "fifa.world",
    name: "FIFA World Cup",
    season: SEASON,
    updatedAt: new Date().toISOString(),
    matchesPlayed: fixtures.length,
    playersTracked: players.length,
    source: "API-Football",
  },
  players,
};

writeFileSync(OUT, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`football performance: ${players.length} players, ${fixtures.length} matches, ${cleanSheetFixtures.length} clean-sheet fixtures`);
