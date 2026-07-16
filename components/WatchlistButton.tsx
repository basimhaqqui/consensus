"use client";

import { useWatchlist } from "./WatchlistProvider";
import type { WatchItem } from "@/lib/watchlist";

export default function WatchlistButton({
  item,
  compact = false,
  iconOnly = false,
  className = "",
}: {
  item: WatchItem;
  compact?: boolean;
  iconOnly?: boolean;
  className?: string;
}) {
  const { isWatching, toggleItem, ready } = useWatchlist();
  const watched = isWatching(item.key);
  const label = watched ? `Remove ${item.title} from watchlist` : `Add ${item.title} to watchlist`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={watched}
      title={label}
      disabled={!ready}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        toggleItem(item);
      }}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] border font-medium uppercase transition disabled:cursor-wait disabled:opacity-45 ${
        watched
          ? "border-accent/45 bg-accent/12 text-accent shadow-[0_10px_28px_-18px_rgba(52,211,153,0.8)]"
          : "border-line bg-black/25 text-muted hover:border-zinc-500/60 hover:bg-white/[0.045] hover:text-zinc-200"
      } ${iconOnly ? "h-7 w-7 text-[14px]" : compact ? "px-2.5 py-1.5 text-[10px] tracking-[0.13em]" : "px-3 py-2 text-[10px] tracking-[0.14em]"} ${className}`}
    >
      <span aria-hidden="true">{watched ? "★" : "☆"}</span>
      {!iconOnly && <span>{watched ? "Watching" : "Watch"}</span>}
    </button>
  );
}
