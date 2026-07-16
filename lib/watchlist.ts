export type WatchKind = "match" | "player" | "fighter";

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
  kickoff: boolean;
  live: boolean;
  results: boolean;
};

export const DEFAULT_ALERT_PREFERENCES: AlertPreferences = {
  kickoff: true,
  live: true,
  results: true,
};

export const WATCHLIST_STORAGE_KEY = "consensus.watchlist.v1";
export const ALERTS_STORAGE_KEY = "consensus.alerts.v1";
export const NOTIFIED_STORAGE_KEY = "consensus.notified.v1";

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
      kickoff: parsed.kickoff ?? DEFAULT_ALERT_PREFERENCES.kickoff,
      live: parsed.live ?? DEFAULT_ALERT_PREFERENCES.live,
      results: parsed.results ?? DEFAULT_ALERT_PREFERENCES.results,
    };
  } catch {
    return DEFAULT_ALERT_PREFERENCES;
  }
}

function isWatchItem(value: unknown): value is WatchItem {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<WatchItem>;
  if (
    typeof item.key !== "string" ||
    item.key.length > 200 ||
    (item.kind !== "match" &&
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
