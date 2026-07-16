"use client";

import { useEffect, useState } from "react";
import { grade, loadPicks, savePicks, type Method, type Pick, type Side } from "@/lib/ufc/predictor";

const lastName = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");
const METHOD_LABEL: Record<Method, string> = { ko: "KO/TKO", sub: "SUB", dec: "DEC" };

export default function PicksBoard() {
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const loaded = loadPicks();
    setPicks(loaded);
    setHydrated(true);

    // Late-grade anything the live feed missed, from the repo's results history.
    const ungraded = Object.entries(loaded).filter(
      ([, p]) => !p.graded && new Date(p.date).getTime() < Date.now() - 30 * 60e3
    );
    if (!ungraded.length) return;
    fetch(`/ufc/api/results?bouts=${ungraded.map(([id]) => id).join(",")}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.results) return;
        setPicks((prev) => {
          const next = { ...prev };
          let changed = false;
          for (const [boutId, p] of ungraded) {
            const res = d.results[boutId];
            if (!res) continue;
            const winnerSide: Side | null =
              res.winnerId === null ? null : res.winnerId === String(p.a.id) ? "a" : "b";
            next[boutId] = {
              ...p,
              graded: grade(p, { winnerSide, method: res.method, round: res.round, nc: res.winnerId === null }),
            };
            changed = true;
          }
          if (changed) savePicks(next);
          return next;
        });
      })
      .catch(() => {});
  }, []);

  const all = Object.values(picks).sort((x, y) => y.date.localeCompare(x.date));
  const graded = all.filter((p) => p.graded && p.graded.winnerSide !== null);
  const userPts = graded.reduce((s, p) => s + p.graded!.userPts, 0);
  const modelPts = graded.reduce((s, p) => s + p.graded!.modelPts, 0);
  const winners = graded.filter((p) => p.w === p.graded!.winnerSide).length;
  const methods = graded.filter((p) => p.graded!.method && p.m === p.graded!.method).length;

  const byEvent = new Map<string, Pick[]>();
  for (const p of all) {
    if (!byEvent.has(p.event)) byEvent.set(p.event, []);
    byEvent.get(p.event)!.push(p);
  }

  if (!hydrated) return null;

  return (
    <>
      <section>
        <div className="section-heading" data-index="02">
          <h2>Head-to-head scorecard</h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">you / model</span>
        </div>
        <div className="terminal-kpi-grid grid grid-cols-2 gap-px lg:grid-cols-4">
          <Stat
            label="Your score"
            value={`${userPts}`}
            sub={`${methods} methods called`}
            valueClass="text-accent"
          />
          <Stat
            label="Model score"
            value={`${modelPts}`}
            sub={userPts > modelPts ? "you lead" : userPts < modelPts ? "model leads" : "tied"}
            valueClass="text-blue"
          />
          <Stat
            label="Winner calls"
            value={graded.length ? `${winners}/${graded.length}` : "—"}
            sub={
              graded.length
                ? `${((winners / graded.length) * 100).toFixed(0)}% hit rate`
                : "awaiting results"
            }
          />
          <Stat label="Fights picked" value={`${all.length}`} sub={`${graded.length} graded`} />
        </div>
      </section>

      {all.length === 0 ? (
        <section className="mt-10">
          <div className="section-heading" data-index="03">
            <h2>Pick board</h2>
            <span className="text-[10px] text-muted tabnums">[0]</span>
          </div>
          <p className="terminal-empty p-8 text-center text-sm">
            No picks yet — open an upcoming event and call every fight: winner, method, round.
          </p>
        </section>
      ) : (
        [...byEvent.entries()].map(([event, list], eventIndex) => (
          <section key={event} className="mt-10">
            <div
              className="section-heading"
              data-index={String(eventIndex + 3).padStart(2, "0")}
            >
              <h2>{event}</h2>
              <span className="text-[10px] text-muted tabnums">[{list.length}]</span>
            </div>
            <div className="terminal-panel">
              <div className="terminal-panel-header hidden grid-cols-[72px_minmax(0,1.2fr)_minmax(145px,0.85fr)_minmax(145px,0.85fr)_112px] gap-5 px-5 py-2.5 text-[10px] uppercase tracking-[0.16em] text-muted md:grid">
                <span>Grade</span>
                <span>Bout / model call</span>
                <span>Your call</span>
                <span>Actual result</span>
                <span className="text-right">Points</span>
              </div>
              <div className="divide-y divide-line/60">
                {list.map((p) => {
                  const g = p.graded;
                  const hit = g && g.winnerSide !== null ? p.w === g.winnerSide : null;
                  const fmt = (w: Side, m: Method, r: number | null) =>
                    `${lastName(w === "a" ? p.a.name : p.b.name)} · ${METHOD_LABEL[m]}${r ? ` R${r}` : ""}`;
                  const gradeLabel = g
                    ? g.winnerSide === null
                      ? "NC"
                      : hit
                        ? "WIN"
                        : "LOSS"
                    : "OPEN";
                  const gradeTone = g
                    ? g.winnerSide === null
                      ? "border-zinc-600/50 bg-zinc-800/40 text-zinc-400"
                      : hit
                        ? "border-accent/30 bg-accent/10 text-accent"
                        : "border-danger/30 bg-danger/10 text-danger"
                    : "border-blue/25 bg-blue/[0.07] text-blue";

                  return (
                    <article
                      key={`${p.eventId}-${p.a.id}-${p.b.id}`}
                      className={`group grid gap-4 px-4 py-4 transition-colors md:grid-cols-[72px_minmax(0,1.2fr)_minmax(145px,0.85fr)_minmax(145px,0.85fr)_112px] md:items-center md:gap-5 md:px-5 ${
                        hit === true
                          ? "bg-accent/[0.025] hover:bg-accent/[0.045]"
                          : hit === false
                            ? "bg-danger/[0.025] hover:bg-danger/[0.045]"
                            : "hover:bg-white/[0.025]"
                      }`}
                    >
                      <div className="flex items-center gap-3 md:block">
                        <span
                          className={`display inline-flex min-w-14 items-center justify-center rounded border px-2 py-1.5 text-[10px] font-extrabold tracking-[0.12em] ${gradeTone}`}
                        >
                          {gradeLabel}
                        </span>
                        <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600 md:mt-1.5 md:block">
                          {g ? "graded" : "pending"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <div className="display truncate text-xl font-bold text-zinc-200 group-hover:text-white">
                          {lastName(p.a.name)}
                          <span className="px-1.5 text-zinc-700">vs</span>
                          {lastName(p.b.name)}
                        </div>
                        <div className="mt-1 truncate text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                          Model / <span className="normal-case tracking-normal">{fmt(p.model.w, p.model.m, p.model.r)}</span>
                        </div>
                      </div>

                      <PickCell label="Your call" value={fmt(p.w, p.m, p.r)} valueClass="text-zinc-100" />
                      <PickCell
                        label="Actual result"
                        value={
                          g
                            ? g.winnerSide === null
                              ? "No contest"
                              : fmt(g.winnerSide, g.method ?? "dec", g.round)
                            : "Awaiting result"
                        }
                        valueClass={hit === true ? "text-accent" : hit === false ? "text-danger" : "text-muted"}
                      />

                      <div className="grid grid-cols-2 gap-3 border-t border-line/60 pt-3 text-right md:border-0 md:pt-0">
                        <Score label="You" value={g && g.winnerSide !== null ? `${g.userPts}` : "—"} valueClass={hit ? "text-accent" : ""} />
                        <Score label="Model" value={g && g.winnerSide !== null ? `${g.modelPts}` : "—"} muted />
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        ))
      )}

      <p className="mt-6 text-[10px] text-zinc-600">
        Picks live in this browser only. Scoring: winner 3 · method +2 · round +1 (finishes).
        Model picks are snapshotted when you make yours — a fair fight.
      </p>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="terminal-kpi px-4 py-4 sm:px-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={`display mt-1 text-3xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600 tabnums">{sub}</div>
    </div>
  );
}

function PickCell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] uppercase tracking-[0.15em] text-muted md:hidden">{label}</div>
      <div className={`mt-1 truncate text-xs font-medium tabnums md:mt-0 ${valueClass}`}>{value}</div>
    </div>
  );
}

function Score({
  label,
  value,
  muted = false,
  valueClass = "",
}: {
  label: string;
  value: string;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">{label}</div>
      <div className={`display mt-0.5 text-lg font-bold tabnums ${muted ? "text-muted" : "text-zinc-200"} ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
