"use client";

import { useEffect, useState } from "react";
import { getBout, inLiveWindow, subscribe, type LiveBout } from "@/components/ufc/liveFeed";

// The unmissable result strip on a finished fight: WHO won and HOW, plus a separate
// labeled chip grading our pre-fight pick.
export default function ResultBanner({
  eventId,
  boutId,
  fightDate,
  aId,
  aName,
  bName,
  pA,
}: {
  eventId: string;
  boutId: string;
  fightDate: string;
  aId: string | null;
  aName: string | null;
  bName: string | null;
  pA: number;
}) {
  const [bout, setBout] = useState<LiveBout | null>(null);

  useEffect(() => {
    if (!inLiveWindow(fightDate)) return;
    return subscribe(eventId, () => {
      const d = getBout(eventId, boutId);
      if (d) setBout(d);
    });
  }, [eventId, boutId, fightDate]);

  if (!bout || bout.state !== "post" || !bout.winnerId) return null;

  const aWon = bout.winnerId === String(aId);
  const winner = (aWon ? aName : bName) ?? "";
  const winnerLast = winner.split(" ").slice(1).join(" ") || winner;
  const hit = (pA >= 0.5) === aWon;
  const isDec = (bout.method ?? "").toLowerCase().includes("dec");
  const how = bout.method
    ? `${bout.method}${!isDec && bout.period ? ` · R${bout.period}${bout.clock && bout.clock !== "-" ? ` ${bout.clock}` : ""}` : ""}`
    : null;

  return (
    <div
      className={`mb-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2 ${
        aWon ? "border-red/40 bg-red/10" : "border-blue/40 bg-blue/10"
      }`}
    >
      <span className="flex items-baseline gap-2 min-w-0">
        <span className="display text-base font-extrabold uppercase truncate">
          {winnerLast} wins
        </span>
        {how && <span className="text-[11px] text-zinc-300 whitespace-nowrap">{how}</span>}
      </span>
      <span
        className={`whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider tabnums ${
          hit ? "border-emerald-400/50 text-emerald-400" : "border-danger/50 text-danger"
        }`}
      >
        pick {hit ? "✓" : "✗"} {(Math.max(pA, 1 - pA) * 100).toFixed(0)}%
      </span>
    </div>
  );
}
