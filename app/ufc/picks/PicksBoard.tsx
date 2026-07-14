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
        <div className="section-heading" data-index="02"><h2>Scorecard</h2></div>
        <div className="terminal-kpi-grid grid grid-cols-2 gap-px sm:grid-cols-4">
        <Stat label="Fights picked" value={`${all.length}`} sub={`${graded.length} graded`} />
        <Stat
          label="Winners hit"
          value={graded.length ? `${winners}/${graded.length}` : "—"}
          sub={graded.length ? `${((winners / graded.length) * 100).toFixed(0)}%` : "awaiting results"}
        />
        <Stat label="Your points" value={`${userPts}`} sub={`${methods} methods called`} valueClass="text-emerald-400" />
        <Stat
          label="vs model"
          value={`${modelPts}`}
          sub={userPts > modelPts ? "you lead" : userPts < modelPts ? "model leads" : "tied"}
          valueClass="text-accent"
        />
        </div>
      </section>

      {all.length === 0 ? (
        <p className="terminal-empty mt-8 p-8 text-center text-sm">
          No picks yet — open an upcoming event and call every fight: winner, method, round.
        </p>
      ) : (
        [...byEvent.entries()].map(([event, list]) => (
          <section key={event} className="mt-8">
            <div className="section-heading" data-index="03">
              <h2>{event}</h2>
            </div>
            <div className="terminal-panel overflow-x-auto">
              <table className="w-full text-xs tabnums">
                <thead>
                  <tr className="terminal-panel-header text-[10px] uppercase tracking-wider text-muted">
                    <th className="px-4 py-2 text-left">Fight</th>
                    <th className="px-2 py-2 text-left">Your pick</th>
                    <th className="px-2 py-2 text-left max-sm:hidden">Model pick</th>
                    <th className="px-2 py-2 text-left">Result</th>
                    <th className="px-2 py-2 text-right">You</th>
                    <th className="px-4 py-2 text-right">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((p) => {
                    const g = p.graded;
                    const fmt = (w: Side, m: Method, r: number | null) =>
                      `${lastName(w === "a" ? p.a.name : p.b.name)} · ${METHOD_LABEL[m]}${r ? ` R${r}` : ""}`;
                    return (
                      <tr key={`${p.eventId}-${p.a.id}-${p.b.id}`} className="border-b border-line/50 last:border-0">
                        <td className="px-4 py-1.5">
                          {lastName(p.a.name)} vs {lastName(p.b.name)}
                        </td>
                        <td className="px-2 py-1.5">{fmt(p.w, p.m, p.r)}</td>
                        <td className="px-2 py-1.5 text-muted max-sm:hidden">
                          {fmt(p.model.w, p.model.m, p.model.r)}
                        </td>
                        <td className="px-2 py-1.5 text-muted">
                          {g
                            ? g.winnerSide === null
                              ? "NC"
                              : fmt(g.winnerSide, g.method ?? "dec", g.round)
                            : "…"}
                        </td>
                        <td className={`px-2 py-1.5 text-right ${g && g.userPts > 0 ? "text-emerald-400" : ""}`}>
                          {g && g.winnerSide !== null ? g.userPts : "—"}
                        </td>
                        <td className="px-4 py-1.5 text-right text-muted">
                          {g && g.winnerSide !== null ? g.modelPts : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
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
    <div className="terminal-kpi p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 display text-2xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-muted tabnums">{sub}</div>
    </div>
  );
}
