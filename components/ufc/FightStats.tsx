"use client";

import { useEffect, useRef, useState } from "react";

import { getBout, inLiveWindow, subscribe } from "@/components/ufc/liveFeed";

type StatLine = { kd: number; sig: string; total: string; td: string; sub: number; ctrl: string };

const ROWS: [keyof StatLine, string][] = [
  ["kd", "Knockdowns"],
  ["sig", "Sig. strikes"],
  ["total", "Total strikes"],
  ["td", "Takedowns"],
  ["sub", "Sub attempts"],
  ["ctrl", "Control time"],
];

const landed = (v: string | number) => Number(String(v).split("/")[0]) || 0;
const secs = (v: string | number) => {
  const [m, s] = String(v).split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
};

// Expandable live/final stats comparison, fetched on open, polled while the fight is live.
export default function FightStats({
  eventId,
  boutId,
  fightDate,
  aId,
  bId,
}: {
  eventId: string;
  boutId: string;
  fightDate: string;
  aId: string | null;
  bId: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Record<string, StatLine> | null>(null);
  const [, force] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!inLiveWindow(fightDate)) return;
    return subscribe(eventId, () => force((x) => x + 1));
  }, [eventId, fightDate]);

  const bout = getBout(eventId, boutId);
  const started = bout ? bout.state !== "pre" : Date.now() > new Date(fightDate).getTime() + 15 * 60e3;

  // The whole card toggles stats once the fight has started — clicking a link or a
  // button inside the card keeps its own behavior.
  useEffect(() => {
    if (!started) return;
    const card = rootRef.current?.closest('[id^="bout-"]') as HTMLElement | null;
    if (!card) return;
    card.classList.add("cursor-pointer");
    const onClick = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest("a,button")) return;
      setOpen((o) => !o);
    };
    card.addEventListener("click", onClick);
    return () => {
      card.removeEventListener("click", onClick);
      card.classList.remove("cursor-pointer");
    };
  }, [started]);

  useEffect(() => {
    if (!open) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    const load = () =>
      fetch(`/ufc/api/stats/${eventId}/${boutId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setData(d.byId))
        .catch(() => {});
    load();
    timer.current = setInterval(() => {
      if (getBout(eventId, boutId)?.state === "in") load();
    }, 20000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [open, eventId, boutId]);

  if (!started) {
    return (
      <div ref={rootRef} className="hidden" />
    );
  }

  const a = data?.[String(aId)] ?? null;
  const b = data?.[String(bId)] ?? null;

  return (
    <div ref={rootRef} className="border-t border-line">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] text-muted hover:text-zinc-300 flex items-center justify-center gap-1.5"
      >
        <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
        Fight stats
        {bout?.state === "in" && <span className="text-accent">· live</span>}
      </button>
      {open && (
        <div className="px-4 pb-3">
          {!data ? (
            <div className="py-2 text-center text-[11px] text-muted">loading…</div>
          ) : !a && !b ? (
            <div className="py-2 text-center text-[11px] text-muted">no stats posted yet</div>
          ) : (
            <table className="w-full text-[11px] tabnums">
              <tbody>
                {ROWS.map(([k, label]) => {
                  const av = a?.[k] ?? "—";
                  const bv = b?.[k] ?? "—";
                  const cmp = k === "ctrl" ? secs(av) - secs(bv) : landed(av) - landed(bv);
                  return (
                    <tr key={k} className="border-b border-line/40 last:border-0">
                      <td className={`py-1 w-1/3 text-left ${cmp > 0 ? "text-red font-bold" : "text-zinc-300"}`}>
                        {av}
                      </td>
                      <td className="py-1 text-center text-[10px] uppercase tracking-wider text-muted">
                        {label}
                      </td>
                      <td className={`py-1 w-1/3 text-right ${cmp < 0 ? "text-blue font-bold" : "text-zinc-300"}`}>
                        {bv}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
