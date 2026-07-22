"use client";

import Link from "next/link";
import { useWatchlist } from "./WatchlistProvider";

export default function ClubMovementPanel({
  clubKey,
  currentProbability,
  books,
}: {
  clubKey: string;
  currentProbability?: number;
  books?: number;
}) {
  const { isWatching, marketAlerts, ready } = useWatchlist();
  const watched = isWatching(clubKey);
  const history = marketAlerts
    .filter((alert) => alert.clubKey === clubKey)
    .sort((left, right) => right.observedAt.localeCompare(left.observedAt))
    .slice(0, 4);

  return (
    <div className="terminal-panel h-full">
      <div className="terminal-panel-header flex items-center justify-between px-4 py-3 text-[10px] uppercase tracking-[0.16em] text-muted">
        <span>Market movement</span>
        {currentProbability !== undefined && (
          <span className="tabnums text-zinc-300">
            {Math.round(currentProbability * 100)}%{books ? ` · ${books} books` : ""}
          </span>
        )}
      </div>
      <div className="p-4">
        {!ready ? (
          <p className="text-[11px] text-muted">Loading local market history…</p>
        ) : history.length > 0 ? (
          <div className="divide-y divide-line/60">
            {history.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                <div>
                  <div className="tabnums text-sm text-zinc-200">
                    {Math.round(alert.previousProbability * 100)}%
                    <span className="px-1.5 text-zinc-600">→</span>
                    {Math.round(alert.probability * 100)}%
                  </div>
                  <time className="mt-1 block text-[9px] uppercase tracking-[0.12em] text-zinc-600" dateTime={alert.observedAt}>
                    {formatObserved(alert.observedAt)}
                  </time>
                </div>
                <span className={`rounded border px-2 py-1 text-[10px] font-semibold tabnums ${
                  alert.delta > 0
                    ? "border-accent/35 bg-accent/10 text-accent"
                    : "border-warn/35 bg-warn/[0.08] text-warn"
                }`}>
                  {alert.delta > 0 ? "+" : ""}{Math.round(alert.delta * 100)} pts
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <p className="text-[11px] leading-relaxed text-muted">
              {watched
                ? "Baseline active. A move of 3 percentage points or more will appear here."
                : "Watch this club to establish a market baseline and track meaningful price moves."}
            </p>
            <Link href="/watchlist" className="mt-3 inline-flex text-[10px] uppercase tracking-[0.14em] text-accent hover:text-emerald-300">
              Open watchlist →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function formatObserved(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}
