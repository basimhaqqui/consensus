"use client";

import { useEffect, useState } from "react";
import { getBout, inLiveWindow, subscribe } from "@/components/ufc/liveFeed";

type FightRef = { boutId: string; date: string; aName: string | null; bName: string | null; pA: number };

const last = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "");

// Floating fight-night bar: pinned bottom-center whenever a fight on this card is live,
// links to that fight's card (anchor works from the homepage and the event page alike).
export default function LiveNowBar({ eventId, fights }: { eventId: string; fights: FightRef[] }) {
  const [, force] = useState(0);

  useEffect(() => {
    if (!fights.some((f) => inLiveWindow(f.date))) return;
    return subscribe(eventId, () => force((x) => x + 1));
  }, [eventId, fights]);

  const live = fights
    .map((f) => ({ f, b: getBout(eventId, f.boutId) }))
    .filter((x) => x.b?.state === "in")
    .at(-1); // if two overlap momentarily, prefer the later bout

  if (!live?.b) return null;
  const { f, b } = live;

  return (
    <a
      href={`/ufc/event/${eventId}#bout-${f.boutId}`}
      className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex max-w-[94vw] items-center gap-2.5 whitespace-nowrap rounded-full border border-accent/50 bg-panel/95 px-4 py-2 text-xs card-shadow backdrop-blur hover:bg-panel2"
    >
      <span className="flex items-center gap-1.5 text-accent font-bold uppercase tracking-wider">
        <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
        Live{b.period ? ` R${b.period} ${b.clock && b.clock !== "-" ? b.clock : ""}` : ""}
      </span>
      <span className="display text-sm font-extrabold uppercase truncate">
        {last(f.aName)} <span className="text-zinc-600">vs</span> {last(f.bName)}
      </span>
      <span className="tabnums text-muted max-sm:hidden">
        {(f.pA * 100).toFixed(0)}% / {((1 - f.pA) * 100).toFixed(0)}%
      </span>
      <span className="text-accent">↓</span>
    </a>
  );
}
