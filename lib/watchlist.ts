export type WatchKind = "club" | "match" | "player" | "fighter";

export type WatchItem = {
  key: string;
  kind: WatchKind;
  title: string;
  context: string;
  href: string;
  startsAt?: string;
  image?: string;
};

export type AlertPreferences = {
  market: boolean;
  kickoff: boolean;
  live: boolean;
  results: boolean;
};

export type ClubMarketQuote = {
  clubKey: string;
  league: string;
  club: string;
  opponent: string;
  fixtureKey: string;
  kickoff: string;
  probability: number;
  books: number;
};

export type MarketMovementAlert = ClubMarketQuote & {
  id: string;
  previousProbability: number;
  delta: number;
  observedAt: string;
};

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  market: true,
  kickoff: true,
  live: true,
  results: true,
};

export const WATCHLIST_STORAGE_KEY = "consensus.watchlist.v1";
export const ALERTS_STORAGE_KEY = "consensus.alerts.v1";
export const NOTIFIED_STORAGE_KEY = "consensus.notified.v1";
export const MARKET_SNAPSHOTS_STORAGE_KEY = "consensus.market-snapshots.v1";
export const MARKET_ALERTS_STORAGE_KEY = "consensus.market-alerts.v1";

export function parseStoredItems(value: string | null): WatchItem[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isWatchItem).slice(0, 50);
  } catch {
    return [];
  }
}

export function parseStoredPreferences(value: string | null): AlertPreferences {
  if (!value) return DEFAULT_ALERT_PREFERENCES;
  try {
    const parsed = JSON.parse(value) as Partial<AlertPreferences>;
    return {
      market: parsed.market ?? DEFAULT_ALERT_PREFERENCES.market,
      kickoff: parsed.kickoff ?? DEFAULT_ALERT_PREFERENCES.kickoff,
      live: parsed.live ?? DEFAULT_ALERT_PREFERENCES.live,
      results: parsed.results ?? DEFAULT_ALERT_PREFERENCES.results,
    };
  } catch {
    return DEFAULT_ALERT_PREFERENCES;
  }
}

export function parseStoredMarketSnapshots(
  value: string | null
): Record<string, ClubMarketQuote> {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .filter((entry): entry is [string, ClubMarketQuote] => {
          return isClubMarketQuote(entry[1]) && entry[0] === entry[1].clubKey;
        })
        .slice(0, 50)
    );
  } catch {
    return {};
  }
}

export function parseStoredMarketAlerts(
  value: string | null
): MarketMovementAlert[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMarketMovementAlert).slice(0, 30);
  } catch {
    return [];
  }
}

function isWatchItem(value: unknown): value is WatchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WatchItem>;
  if (
    typeof item.key !== "string" ||
    item.key.length > 200 ||
    (item.kind !== "club" &&
      item.kind !== "match" &&
      item.kind !== "player" &&
      item.kind !== "fighter") ||
    typeof item.title !== "string" ||
    item.title.length > 160 ||
    typeof item.context !== "string" ||
    item.context.length > 240 ||
    typeof item.href !== "string" ||
    !item.href.startsWith("/") ||
    item.href.startsWith("//") ||
    item.href.length > 500
  ) {
    return false;
  }
  if (!item.key.startsWith(`${item.kind}:`)) return false;
  if (
    item.startsAt !== undefined &&
    (typeof item.startsAt !== "string" ||
      Number.isNaN(Date.parse(item.startsAt)))
  ) {
    return false;
  }
  if (
    item.image !== undefined &&
    (typeof item.image !== "string" ||
      !/^https:\/\/[^\s]+$/i.test(item.image) ||
      item.image.length > 800)
  ) {
    return false;
  }
  return true;
}

function isClubMarketQuote(value: unknown): value is ClubMarketQuote {
  if (!value || typeof value !== "object") return false;
  const quote = value as Partial<ClubMarketQuote>;
  return (
    typeof quote.clubKey === "string" &&
    quote.clubKey.startsWith("club:") &&
    quote.clubKey.length <= 200 &&
    typeof quote.league === "string" &&
    quote.league.length <= 40 &&
    typeof quote.club === "string" &&
    quote.club.length <= 160 &&
    typeof quote.opponent === "string" &&
    quote.opponent.length <= 160 &&
    typeof quote.fixtureKey === "string" &&
    quote.fixtureKey.length <= 500 &&
    typeof quote.kickoff === "string" &&
    !Number.isNaN(Date.parse(quote.kickoff)) &&
    typeof quote.probability === "number" &&
    quote.probability >= 0 &&
    quote.probability <= 1 &&
    typeof quote.books === "number" &&
    Number.isInteger(quote.books) &&
    quote.books > 0 &&
    quote.books <= 100
  );
}

function isMarketMovementAlert(value: unknown): value is MarketMovementAlert {
  if (!isClubMarketQuote(value)) return false;
  const alert = value as Partial<MarketMovementAlert>;
  return (
    typeof alert.id === "string" &&
    alert.id.length <= 800 &&
    typeof alert.previousProbability === "number" &&
    alert.previousProbability >= 0 &&
    alert.previousProbability <= 1 &&
    typeof alert.delta === "number" &&
    Math.abs(alert.delta) <= 1 &&
    typeof alert.observedAt === "string" &&
    !Number.isNaN(Date.parse(alert.observedAt))
  );
}
