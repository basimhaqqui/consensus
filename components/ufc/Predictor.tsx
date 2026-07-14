"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FighterFace from "@/components/ufc/FighterFace";
import { getBout, inLiveWindow, subscribe } from "@/components/ufc/liveFeed";
import { classifyMethod, grade, loadPicks, savePicks, type Method, type Pick, type Side } from "@/lib/ufc/predictor";

export type PredictorFight = {
  boutId: string;
  date: string;
  a: { id: string | null; name: string | null };
  b: { id: string | null; name: string | null };
  pA: number; // model win prob for A
  method: { ko: number; sub: number; dec: number } | null;
  fiveRounds: boolean;
};

const lastName = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");
const METHODS: [Method, string][] = [
  ["ko", "KO/TKO"],
  ["sub", "SUB"],
  ["dec", "DEC"],
];

function modelPickFor(f: PredictorFight): { w: Side; m: Method; r: number | null } {
  const w: Side = f.pA >= 0.5 ? "a" : "b";
  const m: Method = f.method
    ? ((Object.entries(f.method).sort((x, y) => y[1] - x[1])[0][0] as Method) ?? "dec")
    : "dec";
  return { w, m, r: m === "dec" ? null : 1 }; // R1 is always the most likely finish round
}

function FightPickRow({
  eventId,
  eventName,
  f,
  pick,
  onPick,
}: {
  eventId: string;
  eventName: string;
  f: PredictorFight;
  pick: Pick | undefined;
  onPick: (boutId: string, p: Pick | null) => void;
}) {
  const bout = getBout(eventId, f.boutId);
  const locked = bout ? bout.state !== "pre" : Date.now() > new Date(f.date).getTime();

  const set = (patch: Partial<{ w: Side; m: Method; r: number | null }>) => {
    if (locked) return;
    const base = pick ?? {
      eventId,
      event: eventName,
      date: f.date,
      a: f.a,
      b: f.b,
      w: "a" as Side,
      m: "dec" as Method,
      r: null,
      model: modelPickFor(f),
      at: new Date().toISOString(),
    };
    const next: Pick = { ...base, ...patch };
    if (next.m === "dec") next.r = null;
    else if (next.r === null) next.r = 1;
    onPick(f.boutId, next);
  };

  const rounds = f.fiveRounds ? [1, 2, 3, 4, 5] : [1, 2, 3];
  const g = pick?.graded;

  return (
    <div className="terminal-panel terminal-panel--interactive">
      <div className="terminal-panel-header flex items-center justify-between gap-3 px-4 py-2 text-[8px] uppercase tracking-[0.18em] text-muted">
        <span>Winner / method / round</span>
        <span className="truncate tabnums">
          {lastName(f.a.name)} <span className="px-1 text-zinc-700">vs</span> {lastName(f.b.name)}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 p-3 sm:p-4">
        {([["a", f.a], ["b", f.b]] as const).map(([side, fighter]) => (
          <button
            key={side}
            type="button"
            disabled={locked}
            onClick={() => set({ w: side })}
            aria-pressed={pick?.w === side}
            className={`flex min-h-9 items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs ${
              pick?.w === side
                ? side === "a"
                  ? "border-red/60 bg-red/10 text-red"
                  : "border-blue/60 bg-blue/10 text-blue"
                : "border-line bg-bg/40 text-zinc-300"
            } ${locked ? "cursor-not-allowed opacity-50" : "hover:border-zinc-500 hover:bg-white/[0.025]"}`}
          >
            <FighterFace id={fighter.id} name={fighter.name} size={22} />
            <span className="display font-bold">{lastName(fighter.name)}</span>
          </button>
        ))}

        {pick && (
          <>
            <span className="flex items-center gap-1">
              {METHODS.map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  disabled={locked}
                  onClick={() => set({ m })}
                  aria-pressed={pick.m === m}
                  className={`min-h-8 rounded border px-2 py-1 text-[9px] uppercase tracking-[0.12em] ${
                    pick.m === m ? "border-warn/60 bg-warn/15 text-warn" : "border-line text-muted"
                  } ${locked ? "opacity-60" : "hover:border-zinc-500"}`}
                >
                  {label}
                </button>
              ))}
            </span>
            {pick.m !== "dec" && (
              <span className="flex items-center gap-1">
                {rounds.map((r) => (
                  <button
                    key={r}
                    type="button"
                    disabled={locked}
                    onClick={() => set({ r })}
                    aria-pressed={pick.r === r}
                    className={`min-h-8 min-w-8 rounded border px-1.5 py-1 text-[10px] tabnums ${
                      pick.r === r ? "border-accent/60 bg-accent/15 text-accent" : "border-line text-muted"
                    } ${locked ? "opacity-60" : "hover:border-zinc-500"}`}
                  >
                    R{r}
                  </button>
                ))}
              </span>
            )}
          </>
        )}

        <span className="ml-auto text-[10px] uppercase tracking-wider tabnums">
          {g ? (
            g.winnerSide === null ? (
              <span className="text-zinc-500">NC · void</span>
            ) : (
              <span className={g.userPts > 0 ? "text-emerald-400" : "text-danger"}>
                {g.userPts} pts <span className="text-zinc-600">· model {g.modelPts}</span>
              </span>
            )
          ) : locked ? (
            <span className="text-zinc-600">{pick ? "locked" : "no pick"}</span>
          ) : pick ? (
            <button type="button" onClick={() => onPick(f.boutId, null)} className="rounded px-1 py-0.5 text-zinc-600 hover:text-danger">
              clear
            </button>
          ) : (
            <span className="text-zinc-600">pick winner</span>
          )}
        </span>
      </div>
    </div>
  );
}

export default function Predictor({
  eventId,
  eventName,
  fights,
}: {
  eventId: string;
  eventName: string;
  fights: PredictorFight[];
}) {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [, force] = useState(0);

  useEffect(() => {
    setPicks(loadPicks());
  }, []);

  useEffect(() => {
    if (!fights.some((f) => inLiveWindow(f.date))) return;
    return subscribe(eventId, () => force((x) => x + 1));
  }, [eventId, fights]);

  // Grade any picked fight whose result just landed.
  useEffect(() => {
    const id = setInterval(() => {
      setPicks((prev) => {
        let changed = false;
        const next = { ...prev };
        for (const f of fights) {
          const p = next[f.boutId];
          if (!p || p.graded) continue;
          const b = getBout(eventId, f.boutId);
          if (!b || b.state !== "post") continue;
          if (b.winnerId === null) {
            next[f.boutId] = { ...p, graded: grade(p, { winnerSide: null, method: null, round: null, nc: true }) };
            changed = true;
            continue;
          }
          const method = classifyMethod(b.method);
          if (!method) continue; // method lags the final briefly — grade next tick
          next[f.boutId] = {
            ...p,
            graded: grade(p, {
              winnerSide: b.winnerId === String(f.a.id) ? "a" : "b",
              method,
              round: method === "dec" ? null : b.period,
            }),
          };
          changed = true;
        }
        if (changed) savePicks(next);
        return changed ? next : prev;
      });
    }, 5000);
    return () => clearInterval(id);
  }, [eventId, fights]);

  const onPick = (boutId: string, p: Pick | null) => {
    setPicks((prev) => {
      const next = { ...prev };
      if (p) next[boutId] = p;
      else delete next[boutId];
      savePicks(next);
      return next;
    });
  };

  const onCard = fights.filter((f) => picks[f.boutId]);
  const graded = onCard.map((f) => picks[f.boutId].graded).filter(Boolean);
  const userPts = graded.reduce((s, g) => s + (g?.userPts ?? 0), 0);
  const modelPts = graded.reduce((s, g) => s + (g?.modelPts ?? 0), 0);
  const openCount = fights.filter((f) => {
    const b = getBout(eventId, f.boutId);
    return b ? b.state === "pre" : Date.now() < new Date(f.date).getTime();
  }).length;

  return (
    <section className="mt-10">
      <div className="section-heading flex-wrap" data-index="05">
        <h2>Predictor</h2>
        <span className="hidden text-[9px] uppercase tracking-[0.12em] text-muted sm:inline">
          pick winner · method · round — scored against the model
        </span>
        <Link href="/ufc/picks" className="z-10 ml-auto text-[9px] uppercase tracking-[0.14em] text-muted hover:text-accent">
          My picks →
        </Link>
      </div>

      <div className="terminal-panel mb-4">
        <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[8px] uppercase tracking-[0.18em] text-muted sm:px-5">
          <span>Event scorecard</span>
          <span>win 3 / method +2 / round +1 / locks at fight time</span>
        </div>
        <div className="terminal-kpi-grid grid grid-cols-2 gap-px rounded-none border-x-0 border-b-0 sm:grid-cols-4">
          <div className="terminal-kpi px-4 py-3">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Card picked</div>
            <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums">{onCard.length}/{fights.length}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">selections saved</div>
          </div>
          <div className="terminal-kpi px-4 py-3">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Still open</div>
            <div className="display mt-1 text-2xl font-bold text-warn tabnums">{openCount}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">available bouts</div>
          </div>
          <div className="terminal-kpi px-4 py-3">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Your score</div>
            <div className="display mt-1 text-2xl font-bold text-emerald-400 tabnums">{userPts}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">{graded.length} graded</div>
          </div>
          <div className="terminal-kpi px-4 py-3">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Model score</div>
            <div className="display mt-1 text-2xl font-bold text-accent tabnums">{modelPts}</div>
            <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">
              {graded.length > 0 ? (userPts > modelPts ? "you lead" : userPts < modelPts ? "model leads" : "tied") : "awaiting results"}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {fights.map((f) => (
          <FightPickRow
            key={f.boutId}
            eventId={eventId}
            eventName={eventName}
            f={f}
            pick={picks[f.boutId]}
            onPick={onPick}
          />
        ))}
      </div>
      <p className="mt-3 text-[10px] leading-relaxed text-zinc-600">
        Picks are saved in this browser and graded automatically as results land.
      </p>
    </section>
  );
}
