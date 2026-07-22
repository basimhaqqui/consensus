import "server-only";
import { cache } from "react";

const KEY = process.env.ODDS_API_KEY;

const SPORT_KEYS: Record<string, string> = {
  "eng.1": "soccer_epl",
  "esp.1": "soccer_spain_la_liga",
  "ita.1": "soccer_italy_serie_a",
  "ger.1": "soccer_germany_bundesliga",
  "fra.1": "soccer_france_ligue_one",
  "usa.1": "soccer_usa_mls",
  "bra.1": "soccer_brazil_campeonato",
};

export const CLUB_MARKET_LEAGUES = new Set(Object.keys(SPORT_KEYS));

export type ClubMarketEvent = {
  homeName: string;
  awayName: string;
  commenceTime: string;
  pHome: number;
  pDraw: number;
  pAway: number;
  books: number;
};

export type ClubMarketLine = {
  pHome: number;
  pDraw: number;
  pAway: number;
  books: number;
};

export type ClubTeamMarketLine = ClubMarketLine & {
  homeName: string;
  awayName: string;
  commenceTime: string;
  side: "home" | "away";
  probability: number;
  opponent: string;
};

export const fetchClubMarketOdds = cache(
  async (league: string): Promise<ClubMarketEvent[] | null> => {
    const sport = SPORT_KEYS[league];
    if (!KEY || !sport) return null;
    if (process.env.NODE_ENV === "development" && !process.env.ODDS_DEV) {
      return null;
    }

    const url =
      `https://api.the-odds-api.com/v4/sports/${sport}/odds` +
      `?apiKey=${KEY}&regions=us&markets=h2h&oddsFormat=decimal`;

    let events: any[];
    try {
      const response = await fetch(url, {
        // Shared Next data cache: current enough for the decision desk without
        // burning one provider credit per league on every page request.
        next: { revalidate: 1_800 },
        signal: AbortSignal.timeout(5_000),
      });
      if (!response.ok) return null;
      events = await response.json();
      if (!Array.isArray(events)) return null;
    } catch {
      return null;
    }

    return events.flatMap(parseEvent);
  }
);

export function findClubMarketLine(
  events: ClubMarketEvent[] | null,
  homeName: string,
  awayName: string,
  kickoffISO?: string
): ClubMarketLine | null {
  if (!events?.length) return null;

  const kickoff = kickoffISO ? Date.parse(kickoffISO) : Number.NaN;
  let best:
    | { event: ClubMarketEvent; flipped: boolean; score: number }
    | undefined;

  for (const event of events) {
    if (Number.isFinite(kickoff)) {
      const marketKickoff = Date.parse(event.commenceTime);
      if (
        Number.isFinite(marketKickoff) &&
        Math.abs(marketKickoff - kickoff) > 6 * 60 * 60 * 1000
      ) {
        continue;
      }
    }

    const directHome = teamSimilarity(homeName, event.homeName);
    const directAway = teamSimilarity(awayName, event.awayName);
    const flippedHome = teamSimilarity(homeName, event.awayName);
    const flippedAway = teamSimilarity(awayName, event.homeName);

    const direct = Math.min(directHome, directAway) >= 0.68
      ? directHome + directAway
      : 0;
    const flipped = Math.min(flippedHome, flippedAway) >= 0.68
      ? flippedHome + flippedAway
      : 0;

    const candidate = direct >= flipped
      ? { event, flipped: false, score: direct }
      : { event, flipped: true, score: flipped };
    if (candidate.score > 0 && (!best || candidate.score > best.score)) {
      best = candidate;
    }
  }

  if (!best) return null;
  return best.flipped
    ? {
        pHome: best.event.pAway,
        pDraw: best.event.pDraw,
        pAway: best.event.pHome,
        books: best.event.books,
      }
    : {
        pHome: best.event.pHome,
        pDraw: best.event.pDraw,
        pAway: best.event.pAway,
        books: best.event.books,
      };
}

export function findNextClubTeamMarketLine(
  events: ClubMarketEvent[] | null,
  teamName: string,
  now = Date.now()
): ClubTeamMarketLine | null {
  if (!events?.length) return null;

  const candidates = events.flatMap((event) => {
    const kickoff = Date.parse(event.commenceTime);
    if (!Number.isFinite(kickoff) || kickoff < now - 2 * 60 * 60 * 1000) {
      return [];
    }

    const homeScore = teamSimilarity(teamName, event.homeName);
    const awayScore = teamSimilarity(teamName, event.awayName);
    const side: "home" | "away" = homeScore >= awayScore ? "home" : "away";
    const score = Math.max(homeScore, awayScore);
    if (score < 0.68) return [];

    return [{ event, kickoff, score, side }];
  });

  candidates.sort((left, right) => {
    const confidenceGap = right.score - left.score;
    return Math.abs(confidenceGap) >= 0.08
      ? confidenceGap
      : left.kickoff - right.kickoff;
  });
  const best = candidates[0];
  if (!best) return null;

  return {
    homeName: best.event.homeName,
    awayName: best.event.awayName,
    commenceTime: best.event.commenceTime,
    pHome: best.event.pHome,
    pDraw: best.event.pDraw,
    pAway: best.event.pAway,
    books: best.event.books,
    side: best.side,
    probability:
      best.side === "home" ? best.event.pHome : best.event.pAway,
    opponent:
      best.side === "home" ? best.event.awayName : best.event.homeName,
  };
}

function parseEvent(event: any): ClubMarketEvent[] {
  const homeName = String(event.home_team ?? "");
  const awayName = String(event.away_team ?? "");
  if (!homeName || !awayName) return [];

  let sumHome = 0;
  let sumDraw = 0;
  let sumAway = 0;
  let books = 0;

  for (const bookmaker of event.bookmakers ?? []) {
    const market = (bookmaker.markets ?? []).find(
      (item: any) => item.key === "h2h"
    );
    if (!market) continue;

    let impliedHome = 0;
    let impliedDraw = 0;
    let impliedAway = 0;
    for (const outcome of market.outcomes ?? []) {
      const price = Number(outcome.price);
      if (!(price > 1)) continue;
      const implied = 1 / price;
      if (outcome.name === homeName) impliedHome = implied;
      else if (outcome.name === awayName) impliedAway = implied;
      else impliedDraw = implied;
    }

    const total = impliedHome + impliedDraw + impliedAway;
    if (!impliedHome || !impliedDraw || !impliedAway || !(total > 0)) continue;
    sumHome += impliedHome / total;
    sumDraw += impliedDraw / total;
    sumAway += impliedAway / total;
    books++;
  }

  if (!books) return [];
  return [{
    homeName,
    awayName,
    commenceTime: String(event.commence_time ?? ""),
    pHome: sumHome / books,
    pDraw: sumDraw / books,
    pAway: sumAway / books,
    books,
  }];
}

function teamSimilarity(left: string, right: string) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return 0;
  if (canonical(left) === canonical(right)) return 1;

  let overlap = 0;
  for (const token of a) if (b.has(token)) overlap++;
  if (!overlap) return 0;

  const smaller = Math.min(a.size, b.size);
  const larger = Math.max(a.size, b.size);
  if (overlap === smaller) return 0.88 + 0.12 * (smaller / larger);
  return overlap / (a.size + b.size - overlap);
}

const NOISE = new Set(["afc", "cf", "club", "fc", "sc", "the"]);

function tokens(name: string) {
  return new Set(
    canonical(name)
      .split(" ")
      .filter((token) => token && !NOISE.has(token))
  );
}

function canonical(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
