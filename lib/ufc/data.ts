// Typed accessors over the cron-committed JSON in data/.
// JSON imports are cast `as unknown as T`: TS infers the literal type of the current file,
// and cron-committed data with a different shape stops overlapping it and breaks the build.

import ratingsJson from "@/data/ufc/ratings.json";
import forecastsJson from "@/data/ufc/forecasts.json";
import fightersJson from "@/data/ufc/fighters.json";
import oddsJson from "@/data/ufc/odds.json";
import ledgerJson from "@/data/ufc/ledger.json";
import historyJson from "@/data/ufc/history.json";
import ufcRankingsJson from "@/data/ufc/ufc-rankings.json";
import fightsJson from "@/data/ufc/fights.json";

export type FighterRef = {
  id: string | null;
  name: string | null;
  flag?: string | null;
  record?: string | null;
};

export type FightForecast = {
  boutId: string;
  date: string;
  weightClass: string | null;
  segment?: string | null;
  matchNumber?: number | null;
  a: FighterRef;
  b: FighterRef;
  ratingA: number;
  ratingB: number;
  pA: number;
  fightsA: number;
  fightsB: number;
  method?: { ko: number; sub: number; dec: number } | null;
};

export type CardForecast = {
  eventId: string;
  name: string;
  date: string;
  fights: FightForecast[];
};

export type RatingRow = {
  name: string;
  rating: number;
  p4p?: number;
  division?: string | null;
  fights: number;
  wins: number;
  lastFight: string | null;
};

export type FighterBio = {
  name: string | null;
  dob: string | null;
  height?: number | null;
  reach?: number | null;
  stance?: string | null;
};

const ratingsFile = ratingsJson as unknown as {
  computedAt: string;
  config: Record<string, number>;
  ratings: Record<string, RatingRow>;
};
const forecastsFile = forecastsJson as unknown as { computedAt: string; cards: CardForecast[] };
const fightersFile = fightersJson as unknown as Record<string, FighterBio>;
const oddsFile = oddsJson as unknown as {
  fetchedAt: string;
  byBout: Record<string, { pA: number; books: number; commence: string }>;
};
const ledgerFile = ledgerJson as unknown as { entries: LedgerEntry[] };
const historyFile = historyJson as unknown as Record<string, [number, number][]>;
const fightsFile = fightsJson as unknown as FightResult[];

export type LedgerEntry = {
  boutId: string;
  event: string;
  date: string;
  weightClass: string | null;
  a: FighterRef;
  b: FighterRef;
  model_pA: number;
  books_pA: number | null;
  books: number;
  capturedAt: string;
  result?: {
    noContest?: boolean;
    aWon?: boolean;
    round?: number | null;
    decision?: boolean;
    gradedAt: string;
    llModel?: number;
    llBooks?: number | null;
  };
};

export const computedAt = forecastsFile.computedAt;

// VALUE flag threshold: model vs de-vigged book average, in probability points.
export const VALUE_GAP = 0.08;

export function getBookLine(boutId: string) {
  return oddsFile.byBout[boutId];
}

// The headline number, as in consensus-football: 50/50 model + de-vigged books.
// Falls back to model-only when no line is posted yet.
export function consensusPA(fight: { boutId: string; pA: number }): { p: number; blended: boolean } {
  const book = oddsFile.byBout[fight.boutId];
  if (!book) return { p: fight.pA, blended: false };
  return { p: (fight.pA + book.pA) / 2, blended: true };
}

export function getLedger(): LedgerEntry[] {
  return ledgerFile.entries;
}

export type FightResult = {
  eventId: string;
  eventName: string;
  date: string;
  boutId: string;
  weightClass: string | null;
  a: { id: string; name: string };
  b: { id: string; name: string };
  winnerId: string | null;
  round: number | null;
  clock: string | null;
  decision: boolean;
};

export type UfcDivision = {
  name: string;
  p4p: boolean;
  champion: { name: string; id: string | null } | null;
  ranks: { rank: number; name: string; id: string | null }[];
};

const ufcRankingsFile = ufcRankingsJson as unknown as { updatedAt: string; divisions: UfcDivision[] };

export function getUfcRankings() {
  return ufcRankingsFile;
}

export function getHistory(id: string): [number, number][] {
  return historyFile[id] ?? [];
}

export function getFighterLog(id: string) {
  const log = [];
  for (const f of fightsFile) {
    const isA = String(f.a.id) === id;
    if (!isA && String(f.b.id) !== id) continue;
    const opp = isA ? f.b : f.a;
    log.push({
      boutId: f.boutId,
      date: f.date,
      eventName: f.eventName,
      weightClass: f.weightClass,
      opponent: { id: String(opp.id), name: opp.name },
      won: f.winnerId === null ? null : f.winnerId === (isA ? f.a.id : f.b.id),
      round: f.round,
      clock: f.clock,
      decision: f.decision,
    });
  }
  return log.reverse(); // newest first
}

export function allFighterIds(): string[] {
  return Object.keys(ratingsFile.ratings);
}

// Rank among the active board (same filter as topRatings), 1-based; null if not on it.
let rankIndex: Map<string, number> | null = null;
export function activeRank(id: string): number | null {
  if (!rankIndex) {
    rankIndex = new Map(topRatings(10000).map((r, i) => [r.id, i + 1]));
  }
  return rankIndex.get(id) ?? null;
}

export function getCards(): CardForecast[] {
  return [...forecastsFile.cards].sort((x, y) => x.date.localeCompare(y.date));
}

export function getCard(eventId: string): CardForecast | undefined {
  return forecastsFile.cards.find((c) => c.eventId === eventId);
}

export function getRating(id: string | null): RatingRow | undefined {
  return id ? ratingsFile.ratings[id] : undefined;
}

export function getBio(id: string | null): FighterBio | undefined {
  return id ? fightersFile[id] : undefined;
}

export function headshotUrl(id: string | null): string | null {
  return id ? `https://a.espncdn.com/i/headshots/mma/players/full/${id}.png` : null;
}

// 69 → 5'9"
export function ftIn(inches: number | null | undefined): string | null {
  if (!inches) return null;
  return `${Math.floor(inches / 12)}'${Math.round(inches % 12)}"`;
}

export function ageOf(id: string | null): number | null {
  const dob = getBio(id)?.dob;
  if (!dob) return null;
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 864e5));
}

// P4P board: fought in the last 24 months, ≥5 UFC fights, ranked by today-adjusted Elo
// (rating after layoff decay + age curve at today's date — same constants as forecasts).
export function topRatings(limit = 25): (RatingRow & { id: string })[] {
  const cutoff = new Date(Date.now() - 730 * 864e5).toISOString().slice(0, 10);
  return Object.entries(ratingsFile.ratings)
    .map(([id, r]) => ({ id, ...r }))
    .filter((r) => r.fights >= 5 && (r.lastFight ?? "") >= cutoff)
    .sort((x, y) => (y.p4p ?? y.rating) - (x.p4p ?? x.rating))
    .slice(0, limit);
}
