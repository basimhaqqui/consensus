"use client";

import Link from "next/link";
import WatchlistButton from "./WatchlistButton";
import { useWatchlist } from "./WatchlistProvider";
import type { AlertPreferences, WatchItem, WatchKind } from "@/lib/watchlist";

const GROUPS: Array<{ kind: WatchKind; label: string; empty: string }> = [
  { kind: "match", label: "Matches", empty: "Watch a World Cup match to pin kickoff and live updates here." },
  { kind: "player", label: "Football players", empty: "Open a lineup card and watch a player to keep their competition profile close." },
  { kind: "fighter", label: "UFC fighters", empty: "Watch a fighter from any combat dossier to pin their profile." },
];

const ALERTS: Array<{
  key: keyof AlertPreferences;
  label: string;
  detail: string;
}> = [
  { key: "kickoff", label: "Kickoff reminder", detail: "15 minutes before a watched match" },
  { key: "live", label: "Match goes live", detail: "When a watched match moves in-play" },
  { key: "results", label: "Final result", detail: "Score plus ledger update when the match ends" },
];

export default function WatchlistDashboard() {
  const {
    items,
    preferences,
    permission,
    ready,
    updatePreference,
    enableBrowserAlerts,
  } = useWatchlist();
  const matches = items.filter((item) => item.kind === "match").length;
  const people = items.length - matches;

  return (
    <>
      <section className="site-header pb-7">
        <div className="site-kicker">Personal intelligence desk</div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-end">
          <div>
            <h1 className="site-title">Your watchlist</h1>
            <p className="site-subtitle">
              Keep the matches and people you care about in one focused board.
              Everything stays on this browser—no account required.
            </p>
          </div>
          <div className="terminal-kpi-grid grid grid-cols-3 gap-px overflow-hidden rounded-[9px]">
            <WatchStat label="Saved" value={ready ? items.length : "—"} />
            <WatchStat label="Matches" value={ready ? matches : "—"} />
            <WatchStat label="People" value={ready ? people : "—"} />
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-start">
        <div className="space-y-8">
          {GROUPS.map((group, index) => {
            const groupItems = items.filter((item) => item.kind === group.kind);
            return (
              <section key={group.kind}>
                <div className="section-heading" data-index={String(index + 1).padStart(2, "0")}>
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
                      href={group.kind === "fighter" ? "/ufc" : "/wc"}
                      className="mt-3 inline-flex text-[9px] uppercase tracking-[0.15em] text-accent hover:text-emerald-300"
                    >
                      Explore {group.kind === "fighter" ? "UFC" : "World Cup"} →
                    </Link>
                  </div>
                )}
              </section>
            );
          })}
        </div>

        <aside className="terminal-panel lg:sticky lg:top-5">
          <div className="terminal-panel-header flex items-center justify-between px-4 py-3 text-[9px] uppercase tracking-[0.17em] text-muted">
            <span>Browser alerts</span>
            <span className={permission === "granted" ? "text-accent" : "text-zinc-600"}>
              {permissionLabel(permission)}
            </span>
          </div>
          <div className="p-4">
            <p className="text-[11px] leading-relaxed text-muted">
              Get lightweight reminders for watched World Cup matches while
              Consensus is open. Your choices remain on this device.
            </p>
            {permission !== "granted" && permission !== "unsupported" && (
              <button
                type="button"
                onClick={() => void enableBrowserAlerts()}
                className="mt-4 w-full rounded-[7px] border border-accent/40 bg-accent/10 px-3 py-2.5 text-[9px] font-semibold uppercase tracking-[0.15em] text-accent hover:border-accent/70 hover:bg-accent/15"
              >
                Enable browser alerts
              </button>
            )}
            <div className="mt-4 divide-y divide-line/60 border-y border-line/60">
              {ALERTS.map((alert) => (
                <div key={alert.key} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[11px] font-medium text-zinc-200">{alert.label}</strong>
                    <span className="mt-1 block text-[9px] leading-relaxed text-zinc-600">{alert.detail}</span>
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
            <div className="mt-4 flex items-start gap-2 text-[9px] leading-relaxed text-zinc-600">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent/70" />
              Alerts poll the same live score feed as the World Cup terminal.
            </div>
          </div>
        </aside>
      </section>
    </>
  );
}

function WatchCard({ item }: { item: WatchItem }) {
  return (
    <article className="terminal-panel group flex min-h-32 flex-col p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="rounded border border-line bg-black/20 px-2 py-1 text-[8px] uppercase tracking-[0.16em] text-muted">
          {item.kind}
        </span>
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
            className="mt-3 block text-[9px] uppercase tracking-[0.12em] text-zinc-600 tabnums"
          >
            {formatStart(item.startsAt)}
          </time>
        )}
      </Link>
    </article>
  );
}

function WatchStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="terminal-kpi px-3 py-3">
      <div className="text-[8px] uppercase tracking-[0.15em] text-muted">{label}</div>
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
