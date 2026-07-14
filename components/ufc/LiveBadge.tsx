"use client";

import { useEffect, useState } from "react";
import { getBout, inLiveWindow, subscribe, type LiveBout } from "@/components/ufc/liveFeed";

// Header micro-state: pre = current book line, in = live round clock, post = FINAL
// (the ResultBanner inside the card carries the full who-won-and-how labeling).
export default function LiveBadge({
  eventId,
  boutId,
  fightDate,
}: {
  eventId: string;
  boutId: string;
  fightDate: string;
}) {
  const [bout, setBout] = useState<LiveBout | null>(null);

  useEffect(() => {
    if (!inLiveWindow(fightDate)) return;
    return subscribe(eventId, () => {
      const d = getBout(eventId, boutId);
      if (d) setBout(d);
    });
  }, [eventId, boutId, fightDate]);

  if (!bout) return null;

  if (bout.state === "in") {
    return (
      <span className="flex items-center gap-1.5 whitespace-nowrap text-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
        LIVE{bout.period ? ` R${bout.period} ${bout.clock ?? ""}` : ""}
      </span>
    );
  }

  if (bout.state === "post" && bout.winnerId) {
    return <span className="whitespace-nowrap text-zinc-400">FINAL</span>;
  }

  if (bout.state === "pre" && bout.livePA !== null) {
    return (
      <span className="whitespace-nowrap text-muted">
        live books {(bout.livePA * 100).toFixed(0)}%
      </span>
    );
  }

  return null;
}
