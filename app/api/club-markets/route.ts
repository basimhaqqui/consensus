import {
  CLUB_MARKET_LEAGUES,
  fetchClubMarketOdds,
  findNextClubTeamMarketLine,
} from "@/lib/clubOdds";
import type { ClubMarketQuote } from "@/lib/watchlist";

type ClubRequest = {
  key: string;
  league: string;
  name: string;
};

const MAX_CLUBS = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const clubs = searchParams
    .getAll("club")
    .slice(0, MAX_CLUBS)
    .map(parseClubRequest)
    .filter((club): club is ClubRequest => club !== null);

  const byLeague = new Map<string, ClubRequest[]>();
  for (const club of clubs) {
    const leagueClubs = byLeague.get(club.league) ?? [];
    leagueClubs.push(club);
    byLeague.set(club.league, leagueClubs);
  }
  const groups = await Promise.all(
    [...byLeague].map(async ([league, leagueClubs]) => ({
      league,
      clubs: leagueClubs,
      events: await fetchClubMarketOdds(league),
    }))
  );

  const quotes: ClubMarketQuote[] = groups.flatMap(
    ({ league, clubs: leagueClubs, events }) =>
      leagueClubs.flatMap((club) => {
        const line = findNextClubTeamMarketLine(events, club.name);
        if (!line) return [];
        return [{
          clubKey: club.key,
          league,
          club: club.name,
          opponent: line.opponent,
          fixtureKey: [
            league,
            line.commenceTime,
            line.homeName,
            line.awayName,
          ].join(":"),
          kickoff: line.commenceTime,
          probability: line.probability,
          books: line.books,
        }];
      })
  );

  return Response.json(
    { quotes, observedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}

function parseClubRequest(value: string): ClubRequest | null {
  try {
    const parsed = JSON.parse(value) as Partial<ClubRequest>;
    const keyMatch = parsed.key?.match(/^club:([^:]+):([^:]{1,80})$/);
    if (
      typeof parsed.key !== "string" ||
      typeof parsed.league !== "string" ||
      typeof parsed.name !== "string" ||
      keyMatch?.[1] !== parsed.league ||
      parsed.key.length > 200 ||
      parsed.name.length === 0 ||
      parsed.name.length > 160 ||
      !CLUB_MARKET_LEAGUES.has(parsed.league)
    ) {
      return null;
    }
    return { key: parsed.key, league: parsed.league, name: parsed.name };
  } catch {
    return null;
  }
}
