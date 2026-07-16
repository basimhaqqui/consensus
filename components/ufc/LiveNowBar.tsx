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
      aria-label={`Live now: ${f.aName} versus ${f.bName}. Jump to bout.`}
      className="terminal-panel fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex w-[min(94vw,680px)] -translate-x-1/2 items-center gap-3 border-accent/35 px-3 py-2.5 shadow-[0_20px_55px_-18px_rgba(0,0,0,0.95)] hover:border-accent/65 sm:px-4"
    >
      <span className="flex shrink-0 items-center gap-2 border-r border-line pr-3 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
        <span className="signal-dot ufc-signal-dot" />
        Live signal
      </span>
      <span className="display min-w-0 flex-1 truncate text-sm font-extrabold uppercase text-zinc-100 sm:text-base">
        {last(f.aName)} <span className="text-zinc-600">vs</span> {last(f.bName)}
      </span>
      <span className="shrink-0 rounded border border-accent/25 bg-accent/[0.06] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-accent tabnums">
        {b.period ? `R${b.period} ${b.clock && b.clock !== "-" ? b.clock : ""}` : "In progress"}
      </span>
      <span className="hidden shrink-0 text-[10px] text-muted tabnums md:inline">
        {(f.pA * 100).toFixed(0)} / {((1 - f.pA) * 100).toFixed(0)}
      </span>
      <span aria-hidden="true" className="shrink-0 text-accent">↓</span>
    </a>
  );
}
