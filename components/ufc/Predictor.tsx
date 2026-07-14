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
    <div className="terminal-panel p-3">
      <div className="flex flex-wrap items-center gap-2">
        {([["a", f.a], ["b", f.b]] as const).map(([side, fighter]) => (
          <button
            key={side}
            type="button"
            disabled={locked}
            onClick={() => set({ w: side })}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs ${
              pick?.w === side
                ? side === "a"
                  ? "border-red/60 bg-red/15"
                  : "border-blue/60 bg-blue/15"
                : "border-line"
            } ${locked ? "opacity-60" : "hover:border-zinc-500"}`}
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
                  className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${
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
                    className={`rounded border px-1.5 py-0.5 text-[10px] tabnums ${
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
            <button type="button" onClick={() => onPick(f.boutId, null)} className="text-zinc-600 hover:text-danger">
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
      <div className="section-heading" data-index="05">
        <h2>Predictor</h2>
        <span className="text-[11px] text-muted">
          pick winner · method · round — scored against the model
        </span>
        <Link href="/ufc/picks" className="z-10 ml-auto text-[11px] text-muted hover:text-accent">
          My picks →
        </Link>
      </div>

      <div className="terminal-panel mb-3 flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2 text-xs tabnums">
        <span>
          <span className="text-muted">picked</span> {onCard.length}/{fights.length}
          {openCount > 0 && <span className="text-zinc-600"> · {openCount} still open</span>}
        </span>
        {graded.length > 0 && (
          <span className="flex items-center gap-3">
            <span>
              <span className="text-muted">you</span>{" "}
              <span className="font-bold text-emerald-400">{userPts}</span>
            </span>
            <span>
              <span className="text-muted">model</span>{" "}
              <span className="font-bold text-accent">{modelPts}</span>
            </span>
            <span className="display font-extrabold uppercase">
              {userPts > modelPts ? "you lead" : userPts < modelPts ? "model leads" : "tied"}
            </span>
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-600">
          win 3 · method +2 · round +1 · picks lock at fight time
        </span>
      </div>

      <div className="space-y-2">
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
      <p className="mt-2 text-[10px] text-zinc-600">
        Picks are saved in this browser and graded automatically as results land.
      </p>
    </section>
  );
}
