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
    return parsed.filter(isWatchItem);
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
  return (
    typeof item.key === "string" &&
    (item.kind === "match" || item.kind === "player" || item.kind === "fighter") &&
    typeof item.title === "string" &&
    typeof item.context === "string" &&
    typeof item.href === "string"
  );
}
