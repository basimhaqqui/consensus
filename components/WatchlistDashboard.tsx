"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import WatchlistButton from "./WatchlistButton";
import { useWatchlist } from "./WatchlistProvider";
import {
  parseStoredItems,
  type AlertPreferences,
  type MarketMovementAlert,
  type WatchItem,
  type WatchKind,
} from "@/lib/watchlist";

const GROUPS: Array<{ kind: WatchKind; label: string; empty: string }> = [
  { kind: "club", label: "Clubs", empty: "Watch a club from its match center to track meaningful market moves." },
  { kind: "match", label: "Matches", empty: "Watch a football match to pin kickoff and live updates here." },
  { kind: "player", label: "Football players", empty: "Open a lineup card and watch a player to keep their competition profile close." },
  { kind: "fighter", label: "UFC fighters", empty: "Watch a fighter from any combat dossier to pin their profile." },
];

const ALERTS: Array<{
  key: keyof AlertPreferences;
  label: string;
  detail: string;
}> = [
  { key: "market", label: "Market movement", detail: "When a watched club moves by 3 percentage points" },
  { key: "kickoff", label: "Kickoff reminder", detail: "15 minutes before a watched match" },
  { key: "live", label: "Match goes live", detail: "When a watched match moves in-play" },
  { key: "results", label: "Final result", detail: "Score plus ledger update when the match ends" },
];

export default function WatchlistDashboard() {
  const [shareStatus, setShareStatus] = useState("");
  const [sharedItems, setSharedItems] = useState<WatchItem[]>([]);
  const {
    items,
    preferences,
    marketAlerts,
    permission,
    ready,
    importItems,
    dismissMarketAlert,
    updatePreference,
    enableBrowserAlerts,
  } = useWatchlist();
  const matches = items.filter((item) => item.kind === "match").length;
  const clubs = items.filter((item) => item.kind === "club").length;
  const watchedClubKeys = new Set(
    items.filter((item) => item.kind === "club").map((item) => item.key)
  );
  const activeMarketAlerts = marketAlerts.filter((alert) =>
    watchedClubKeys.has(alert.clubKey)
  );

  useEffect(() => {
    const encoded = new URLSearchParams(window.location.search).get("list");
    if (!encoded) return;
    try {
      const decoded = decodeURIComponent(window.atob(encoded));
      setSharedItems(parseStoredItems(decoded));
    } catch {
      setSharedItems([]);
    }
  }, []);

  const shareWatchlist = async () => {
    if (items.length === 0) return;
    const encoded = window.btoa(encodeURIComponent(JSON.stringify(items)));
    const url = `${window.location.origin}/watchlist?list=${encodeURIComponent(encoded)}`;
    const body = `Open my ${items.length}-item CONSENSUS watchlist.`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: "My CONSENSUS watchlist",
          text: body,
          url,
        });
        setShareStatus("Watchlist shared");
      } else {
        await navigator.clipboard.writeText(url);
        setShareStatus("Share link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareStatus("Sharing unavailable");
    }
    window.setTimeout(() => setShareStatus(""), 2200);
  };

  const acceptSharedItems = () => {
    importItems(sharedItems);
    setSharedItems([]);
    window.history.replaceState({}, "", "/watchlist");
    setShareStatus("Shared watchlist imported");
  };

  const dismissSharedItems = () => {
    setSharedItems([]);
    window.history.replaceState({}, "", "/watchlist");
  };

  return (
    <>
      <section className="site-header pb-7">
        <div className="site-kicker">Personal intelligence desk</div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <h1 className="site-title">Your watchlist</h1>
            <p className="site-subtitle">
              Keep the clubs, matches and people you care about in one focused board.
              Everything stays on this browser—no account required.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void shareWatchlist()}
                disabled={!ready || items.length === 0}
                className="action-secondary disabled:cursor-not-allowed disabled:opacity-40"
              >
                Share watchlist
              </button>
              <span className="rounded-full border border-line bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                On-device
              </span>
              <span className="rounded-full border border-line bg-black/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                No sign-in
              </span>
              <span className="sr-only" role="status" aria-live="polite">
                {shareStatus}
              </span>
              {shareStatus && (
                <span className="text-[10px] uppercase tracking-[0.12em] text-accent">
                  {shareStatus}
                </span>
              )}
            </div>
          </div>
          <div className="terminal-kpi-grid grid grid-cols-3 gap-px overflow-hidden rounded-[9px]">
            <WatchStat label="Saved" value={ready ? items.length : "—"} />
            <WatchStat label="Clubs" value={ready ? clubs : "—"} />
            <WatchStat label="Matches" value={ready ? matches : "—"} />
          </div>
        </div>
      </section>

      {sharedItems.length > 0 && (
        <section className="mt-6 terminal-panel border-accent/30 p-4" aria-label="Shared watchlist">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="site-kicker mb-1">Incoming watchlist</div>
              <p className="text-sm text-zinc-200">
                Add {sharedItems.length} shared {sharedItems.length === 1 ? "item" : "items"} to this device?
              </p>
              <p className="mt-1 text-[10px] text-muted">
                Existing saved items will be kept. Duplicate entries are merged.
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={acceptSharedItems} className="action-primary">
                Import
              </button>
              <button type="button" onClick={dismissSharedItems} className="action-secondary">
                Dismiss
              </button>
            </div>
          </div>
        </section>
      )}

      <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <div className="space-y-8">
          <section>
            <div className="section-heading" data-index="01">
              <h2>Market movement</h2>
              <span className="tabnums text-[10px] text-zinc-600">
                [{activeMarketAlerts.length}]
              </span>
            </div>
            {activeMarketAlerts.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeMarketAlerts.map((alert) => (
                  <MarketAlertCard
                    key={alert.id}
                    alert={alert}
                    onDismiss={() => dismissMarketAlert(alert.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="terminal-empty px-5 py-7">
                <p className="max-w-xl text-xs leading-relaxed text-muted">
                  {clubs > 0
                    ? `Baseline active for ${clubs} watched ${clubs === 1 ? "club" : "clubs"}. A move of 3 percentage points or more will land here.`
                    : "Watch a club from any club match center to establish its market baseline."}
                </p>
                {clubs === 0 && (
                  <Link
                    href="/football"
                    className="mt-3 inline-flex text-[10px] uppercase tracking-[0.15em] text-accent hover:text-emerald-300"
                  >
                    Explore football →
                  </Link>
                )}
              </div>
            )}
          </section>

          {GROUPS.map((group, index) => {
            const groupItems = items
              .filter((item) => item.kind === group.kind)
              .sort(sortWatchItems);
            return (
              <section key={group.kind}>
                <div className="section-heading" data-index={String(index + 2).padStart(2, "0")}>
                  <h2>{group.label}</h2>
                  <span className="tabnums text-[10px] text-zinc-600">[{groupItems.length}]</span>
                </div>
                {groupItems.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {groupItems.map((item) => (
                      <WatchCard key={item.key} item={item} />
                    ))}
                  </div>
                ) : (
                  <div className="terminal-empty px-5 py-7">
                    <p className="max-w-xl text-xs leading-relaxed text-muted">{group.empty}</p>
                    <Link
                      href={group.kind === "fighter" ? "/ufc" : "/football"}
                      className="mt-3 inline-flex text-[10px] uppercase tracking-[0.15em] text-accent hover:text-emerald-300"
                    >
                      Explore {group.kind === "fighter" ? "UFC" : "football"} →
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="terminal-panel lg:sticky lg:top-5">
          <div className="terminal-panel-header flex items-center justify-between px-4 py-3 text-[10px] uppercase tracking-[0.17em] text-muted">
            <span>Browser alerts</span>
            <span className={permission === "granted" ? "text-accent" : "text-zinc-600"}>
              {permissionLabel(permission)}
            </span>
          </div>
          <div className="p-4">
            <p className="text-[11px] leading-relaxed text-muted">
              Get lightweight reminders for watched club markets and football
              matches while Consensus is open. Your choices remain on this device.
            </p>
            {permission === "default" && (
              <button
                type="button"
                onClick={() => void enableBrowserAlerts()}
                className="mt-4 w-full rounded-[7px] border border-accent/40 bg-accent/10 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-accent hover:border-accent/70 hover:bg-accent/15"
              >
                Enable browser alerts
              </button>
            )}
            {permission === "denied" && (
              <div className="mt-4 rounded-[7px] border border-warn/25 bg-warn/[0.06] px-3 py-2.5 text-[10px] leading-relaxed text-warn">
                Alerts are blocked in browser settings. Allow notifications for
                this site, then reload the watchlist.
              </div>
            )}
            {permission === "unsupported" && (
              <div className="mt-4 rounded-[7px] border border-line bg-black/20 px-3 py-2.5 text-[10px] leading-relaxed text-muted">
                This browser does not support page notifications.
              </div>
            )}
            <div className="mt-4 divide-y divide-line/60 border-y border-line/60">
              {ALERTS.map((alert) => (
                <div key={alert.key} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px] font-medium text-zinc-200">{alert.label}</strong>
                    <span className="mt-1 block text-[10px] leading-relaxed text-zinc-600">{alert.detail}</span>
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={preferences[alert.key]}
                    aria-label={alert.label}
                    onClick={() => updatePreference(alert.key, !preferences[alert.key])}
                    className={`relative h-5 w-9 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                      preferences[alert.key]
                        ? "border-accent/40 bg-accent/20"
                        : "border-line bg-zinc-900"
                    }`}
                  >
                    <span
                      className={`absolute left-[3px] top-[3px] h-3 w-3 rounded-full transition ${
                        preferences[alert.key]
                          ? "translate-x-4 bg-accent"
                          : "bg-zinc-600"
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 text-[10px] leading-relaxed text-zinc-600">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
              Market baselines and alert history stay in this browser.
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function MarketAlertCard({
  alert,
  onDismiss,
}: {
  alert: MarketMovementAlert;
  onDismiss: () => void;
}) {
  const upward = alert.delta > 0;
  const direction = upward ? "+" : "";
  const clubAbbr = alert.clubKey.match(/^club:[^:]+:([^:]+)$/)?.[1];

  return (
    <article className="terminal-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-muted">
            {alert.league} · {alert.books} books
          </div>
          <Link
            href={clubAbbr ? `/club/${alert.league}/${clubAbbr}` : `/league/${alert.league}`}
            className="display mt-2 block text-xl font-bold text-zinc-100 hover:text-accent"
          >
            {alert.club}
          </Link>
          <p className="mt-1 text-[11px] text-muted">vs {alert.opponent}</p>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Dismiss ${alert.club} market alert`}
          className="text-lg leading-none text-zinc-600 transition hover:text-zinc-300"
        >
          ×
        </button>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3 border-t border-line/60 pt-3">
        <div className="tabnums text-sm text-zinc-300">
          {Math.round(alert.previousProbability * 100)}%
          <span className="px-1.5 text-zinc-600">→</span>
          <strong className="text-zinc-100">{Math.round(alert.probability * 100)}%</strong>
        </div>
        <span
          className={`rounded border px-2 py-1 text-[10px] font-semibold tabnums ${
            upward
              ? "border-accent/35 bg-accent/10 text-accent"
              : "border-warn/35 bg-warn/[0.08] text-warn"
          }`}
        >
          {direction}{Math.round(alert.delta * 100)} pts
        </span>
      </div>
      <time
        dateTime={alert.observedAt}
        className="mt-2 block text-[10px] uppercase tracking-[0.12em] text-zinc-600"
      >
        Detected {formatObserved(alert.observedAt)}
      </time>
    </article>
  );
}

function WatchCard({ item }: { item: WatchItem }) {
  return (
    <article className="terminal-panel terminal-panel--interactive group flex min-h-36 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <WatchAvatar item={item} />
          <span className="rounded border border-line bg-black/20 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-muted">
            {item.kind}
          </span>
        </div>
        <WatchlistButton item={item} iconOnly />
      </div>
      <Link href={item.href} className="mt-4 block min-w-0">
        <h3 className="display truncate text-xl font-bold text-zinc-100 transition group-hover:text-accent">
          {item.title}
        </h3>
        <p className="mt-1.5 truncate text-[10px] text-muted">{item.context}</p>
        {item.startsAt && (
          <time
            dateTime={item.startsAt}
            className="mt-3 block text-[10px] uppercase tracking-[0.12em] text-zinc-600 tabnums"
          >
            {formatStart(item.startsAt)}
          </time>
        )}
      </Link>
    </article>
  );
}

function WatchAvatar({ item }: { item: WatchItem }) {
  const [broken, setBroken] = useState(false);
  const initials = item.title
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-gradient-to-br from-zinc-700 to-zinc-900 text-[11px] font-semibold text-zinc-300">
      {item.image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover object-top"
          onError={() => setBroken(true)}
        />
      ) : (
        initials || "•"
      )}
    </span>
  );
}

function WatchStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="terminal-kpi px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted">{label}</div>
      <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums">{value}</div>
    </div>
  );
}

function permissionLabel(permission: NotificationPermission | "unsupported") {
  if (permission === "granted") return "Enabled";
  if (permission === "denied") return "Blocked";
  if (permission === "unsupported") return "Unavailable";
  return "Off";
}

function formatStart(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Schedule pending";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatObserved(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function sortWatchItems(a: WatchItem, b: WatchItem) {
  if (a.kind !== "match" || b.kind !== "match") return 0;
  const aStart = a.startsAt ? Date.parse(a.startsAt) : Number.POSITIVE_INFINITY;
  const bStart = b.startsAt ? Date.parse(b.startsAt) : Number.POSITIVE_INFINITY;
  return aStart - bStart;
}
