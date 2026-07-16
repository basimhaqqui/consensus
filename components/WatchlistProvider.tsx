"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ALERTS_STORAGE_KEY,
  DEFAULT_ALERT_PREFERENCES,
  NOTIFIED_STORAGE_KEY,
  WATCHLIST_STORAGE_KEY,
  parseStoredItems,
  parseStoredPreferences,
  type AlertPreferences,
  type WatchItem,
} from "@/lib/watchlist";

type NotificationPermissionState = NotificationPermission | "unsupported";

type WatchlistContextValue = {
  items: WatchItem[];
  preferences: AlertPreferences;
  permission: NotificationPermissionState;
  ready: boolean;
  isWatching: (key: string) => boolean;
  toggleItem: (item: WatchItem) => void;
  removeItem: (key: string) => void;
  importItems: (items: WatchItem[]) => void;
  updatePreference: (key: keyof AlertPreferences, value: boolean) => void;
  enableBrowserAlerts: () => Promise<NotificationPermissionState>;
};

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

type ScoreState = "scheduled" | "live" | "final";
type ScoresPayload = {
  blend?: {
    matches?: Array<{
      id: string;
      status: ScoreState;
      home: { name: string };
      away: { name: string };
      score?: { home: number; away: number };
    }>;
  };
};

const SCORE_REFRESH_MS = 30_000;

export default function WatchlistProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<WatchItem[]>([]);
  const [preferences, setPreferences] = useState<AlertPreferences>(
    DEFAULT_ALERT_PREFERENCES
  );
  const [permission, setPermission] =
    useState<NotificationPermissionState>("unsupported");
  const [ready, setReady] = useState(false);
  const previousScores = useRef(new Map<string, ScoreState>());

  useEffect(() => {
    setItems(parseStoredItems(localStorage.getItem(WATCHLIST_STORAGE_KEY)));
    setPreferences(
      parseStoredPreferences(localStorage.getItem(ALERTS_STORAGE_KEY))
    );
    setPermission(
      "Notification" in window ? Notification.permission : "unsupported"
    );
    setReady(true);

    const syncStorage = (event: StorageEvent) => {
      if (event.key === WATCHLIST_STORAGE_KEY) {
        setItems(parseStoredItems(event.newValue));
      }
      if (event.key === ALERTS_STORAGE_KEY) {
        setPreferences(parseStoredPreferences(event.newValue));
      }
    };
    window.addEventListener("storage", syncStorage);
    return () => window.removeEventListener("storage", syncStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
  }, [items, ready]);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(ALERTS_STORAGE_KEY, JSON.stringify(preferences));
  }, [preferences, ready]);

  const toggleItem = useCallback((item: WatchItem) => {
    setItems((current) => {
      const exists = current.some((saved) => saved.key === item.key);
      const next = exists
        ? current.filter((saved) => saved.key !== item.key)
        : [item, ...current];
      return next;
    });
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((current) => {
      return current.filter((item) => item.key !== key);
    });
  }, []);

  const importItems = useCallback((incoming: WatchItem[]) => {
    setItems((current) => {
      const byKey = new Map(current.map((item) => [item.key, item]));
      for (const item of incoming) byKey.set(item.key, item);
      return [...byKey.values()];
    });
  }, []);

  const updatePreference = useCallback(
    (key: keyof AlertPreferences, enabled: boolean) => {
      setPreferences((current) => {
        return { ...current, [key]: enabled };
      });
    },
    []
  );

  const enableBrowserAlerts = useCallback(async () => {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return "unsupported" as const;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      new Notification("CONSENSUS alerts enabled", {
        body: "Watched match changes will appear while the terminal is open.",
        icon: "/favicon.ico",
      });
    }
    return next;
  }, []);

  useEffect(() => {
    if (!ready || permission !== "granted") return;
    const matchItems = items.filter((item) => item.kind === "match");
    if (matchItems.length === 0) return;

    const notified = new Set<string>(
      parseNotified(localStorage.getItem(NOTIFIED_STORAGE_KEY))
    );

    const notifyOnce = (key: string, title: string, body: string) => {
      if (notified.has(key)) return;
      new Notification(title, { body, icon: "/favicon.ico" });
      notified.add(key);
      localStorage.setItem(NOTIFIED_STORAGE_KEY, JSON.stringify([...notified]));
    };

    const checkKickoffs = () => {
      if (!preferences.kickoff) return;
      const now = Date.now();
      for (const item of matchItems) {
        if (!item.startsAt) continue;
        const until = Date.parse(item.startsAt) - now;
        if (until <= 15 * 60_000 && until >= -2 * 60_000) {
          notifyOnce(
            `kickoff:${item.key}`,
            `${item.title} starts soon`,
            "Kickoff is within 15 minutes. Open the match center for the live model."
          );
        }
      }
    };

    let alive = true;
    const pullScores = async () => {
      try {
        const response = await fetch("/api/scores", { cache: "no-store" });
        if (!response.ok || !alive) return;
        const data = (await response.json()) as ScoresPayload;
        const watchedKeys = new Set(matchItems.map((item) => item.key.slice(6)));
        for (const match of data.blend?.matches ?? []) {
          if (!watchedKeys.has(match.id)) continue;
          const previous = previousScores.current.get(match.id);
          previousScores.current.set(match.id, match.status);
          if (!previous || previous === match.status) continue;
          const title = `${match.home.name} vs ${match.away.name}`;
          if (match.status === "live" && preferences.live) {
            notifyOnce(
              `live:match:${match.id}`,
              `${title} is live`,
              "The live score and in-play forecast are updating now."
            );
          }
          if (match.status === "final" && preferences.results) {
            const score = match.score
              ? `${match.score.home}–${match.score.away}`
              : "Final";
            notifyOnce(
              `final:match:${match.id}`,
              `${title} · ${score}`,
              "The result and prediction ledger have been updated."
            );
          }
        }
      } catch {
        // The watchlist remains available if the live scores endpoint drops.
      }
    };

    checkKickoffs();
    void pullScores();
    const kickoffTimer = window.setInterval(checkKickoffs, 60_000);
    const scoreTimer = window.setInterval(pullScores, SCORE_REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(kickoffTimer);
      window.clearInterval(scoreTimer);
    };
  }, [items, permission, preferences, ready]);

  const value = useMemo<WatchlistContextValue>(
    () => ({
      items,
      preferences,
      permission,
      ready,
      isWatching: (key) => items.some((item) => item.key === key),
      toggleItem,
      removeItem,
      importItems,
      updatePreference,
      enableBrowserAlerts,
    }),
    [
      enableBrowserAlerts,
      items,
      permission,
      preferences,
      ready,
      importItems,
      removeItem,
      toggleItem,
      updatePreference,
    ]
  );

  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlist() {
  const value = useContext(WatchlistContext);
  if (!value) {
    throw new Error("useWatchlist must be used inside WatchlistProvider");
  }
  return value;
}

function parseNotified(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
