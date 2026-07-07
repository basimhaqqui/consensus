"use client";

import { useMemo, useState } from "react";
import {
  scoreGrid,
  marketLegs,
  jointProb,
  probOf,
  americanFromProbStr,
  decimalFromProb,
  parseBookOdds,
  type Grid,
  type LegDef,
} from "@/lib/markets";

export type BuilderMatch = {
  id: string;
  date: string;
  homeCode: string;
  awayCode: string;
  homeFlag: string;
  awayFlag: string;
  lambdaHome: number;
  lambdaAway: number;
};

type Pick = { matchId: string; legKey: string };

export default function BetBuilder({ matches }: { matches: BuilderMatch[] }) {
  const [picks, setPicks] = useState<Pick[]>([]);
  const [open, setOpen] = useState<string | null>(matches[0]?.id ?? null);
  const [bookInput, setBookInput] = useState("");

  const grids = useMemo(() => {
    const m = new Map<string, Grid>();
    for (const x of matches) m.set(x.id, scoreGrid(x.lambdaHome, x.lambdaAway));
    return m;
  }, [matches]);

  const legsFor = useMemo(() => {
    const m = new Map<string, LegDef[]>();
    for (const x of matches) m.set(x.id, marketLegs(x.homeCode, x.awayCode));
    return m;
  }, [matches]);

  const byId = useMemo(
    () => new Map(matches.map((m) => [m.id, m])),
    [matches]
  );

  const toggle = (matchId: string, legKey: string) => {
    setPicks((ps) => {
      const without = ps.filter(
        (p) => !(p.matchId === matchId && p.legKey === legKey)
      );
      if (without.length !== ps.length) return without;
      return [...ps, { matchId, legKey }];
    });
  };

  // Same-match legs price jointly off the score grid (correlations included);
  // different matches multiply as independent events.
  const combined = useMemo(() => {
    const byMatch = new Map<string, LegDef[]>();
    for (const p of picks) {
      const leg = legsFor.get(p.matchId)?.find((l) => l.key === p.legKey);
      if (!leg) continue;
      (byMatch.get(p.matchId) ?? byMatch.set(p.matchId, []).get(p.matchId)!).push(leg);
    }
    let prob = 1;
    for (const [mid, legs] of byMatch) {
      const grid = grids.get(mid);
      if (!grid) continue;
      prob *= jointProb(grid, legs.map((l) => l.test));
    }
    return { prob, matchCount: byMatch.size };
  }, [picks, grids, legsFor]);

  const book = parseBookOdds(bookInput);
  const fairDec = decimalFromProb(combined.prob);
  const edge = book !== null ? book * combined.prob - 1 : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] items-start">
      {/* leg picker */}
      <div className="space-y-3">
        {matches.map((m) => {
          const legs = legsFor.get(m.id)!;
          const grid = grids.get(m.id)!;
          const isOpen = open === m.id;
          const nPicked = picks.filter((p) => p.matchId === m.id).length;
          return (
            <div
              key={m.id}
              className="rounded-xl border border-line bg-panel/70 card-shadow overflow-hidden"
            >
              <button
                onClick={() => setOpen(isOpen ? null : m.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-panel2/40"
              >
                <span className="text-sm font-semibold">
                  {m.homeFlag} {m.homeCode}{" "}
                  <span className="text-muted font-normal">v</span> {m.awayFlag}{" "}
                  {m.awayCode}
                </span>
                <span className="flex items-center gap-3 text-[11px] text-muted">
                  {nPicked > 0 && (
                    <span className="text-accent">{nPicked} leg{nPicked > 1 ? "s" : ""}</span>
                  )}
                  <span>{m.date}</span>
                  <span className="text-zinc-600">{isOpen ? "−" : "+"}</span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-line px-4 py-3 flex flex-wrap gap-1.5">
                  {legs.map((l) => {
                    const active = picks.some(
                      (p) => p.matchId === m.id && p.legKey === l.key
                    );
                    const pr = probOf(grid, l);
                    return (
                      <button
                        key={l.key}
                        onClick={() => toggle(m.id, l.key)}
                        className={`rounded-md border px-2 py-1 text-[11px] transition-colors ${
                          active
                            ? "border-accent/60 bg-accent/15 text-accent"
                            : "border-line bg-panel2/40 text-zinc-300 hover:border-zinc-500"
                        }`}
                      >
                        {l.label}
                        <span className="ml-1.5 tabnums text-[10px] opacity-70">
                          {americanFromProbStr(pr)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* slip */}
      <div className="lg:sticky lg:top-4 rounded-xl border border-line bg-panel card-shadow">
        <div className="px-4 py-3 border-b border-line text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          Slip {picks.length > 0 && <span className="text-accent">[{picks.length}]</span>}
        </div>
        {picks.length === 0 ? (
          <p className="px-4 py-6 text-xs text-muted">
            Pick legs from the matches — same-match combos are priced off the
            model&apos;s joint score distribution, so correlated legs are priced
            honestly (books rarely are).
          </p>
        ) : (
          <div className="px-4 py-3 space-y-2">
            {picks.map((p) => {
              const m = byId.get(p.matchId)!;
              const leg = legsFor.get(p.matchId)!.find((l) => l.key === p.legKey)!;
              return (
                <div
                  key={`${p.matchId}|${p.legKey}`}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="min-w-0 truncate">
                    <span className="text-zinc-500">{m.homeCode}-{m.awayCode}</span>{" "}
                    <span className="text-zinc-200">{leg.label}</span>
                  </span>
                  <button
                    onClick={() => toggle(p.matchId, p.legKey)}
                    className="shrink-0 text-zinc-600 hover:text-danger"
                    aria-label="remove leg"
                  >
                    ✕
                  </button>
                </div>
              );
            })}

            <div className="pt-3 mt-1 border-t border-line space-y-1.5 text-xs tabnums">
              <div className="flex justify-between">
                <span className="text-muted">Model probability</span>
                <span>{(combined.prob * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Fair odds</span>
                <span>
                  {americanFromProbStr(combined.prob)}
                  <span className="ml-2 text-zinc-500">
                    {fairDec < 1000 ? fairDec.toFixed(2) : "—"}
                  </span>
                </span>
              </div>

              <div className="pt-2">
                <label className="block text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
                  Your book&apos;s odds for this slip
                </label>
                <input
                  value={bookInput}
                  onChange={(e) => setBookInput(e.target.value)}
                  placeholder="+650 or 7.50"
                  className="w-full rounded-md border border-line bg-panel2/60 px-2 py-1.5 text-sm tabnums placeholder:text-zinc-600 focus:border-accent/60 focus:outline-none"
                />
              </div>

              {book !== null && edge !== null && (
                <div className="pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted">Edge vs model</span>
                    <span className={edge >= 0 ? "text-accent" : "text-danger"}>
                      {edge >= 0 ? "+" : ""}
                      {(edge * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">EV per $100</span>
                    <span className={edge >= 0 ? "text-accent" : "text-danger"}>
                      {edge >= 0 ? "+" : "−"}${Math.abs(edge * 100).toFixed(0)}
                    </span>
                  </div>
                  <p className="pt-1 text-[10px] leading-relaxed text-zinc-600">
                    {edge >= 0.03
                      ? "Priced better than the model's fair value — the model sees value here."
                      : edge >= -0.08
                      ? "Close to fair — you're paying a thin margin."
                      : "Well below fair value — this is the builder margin books count on."}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        <p className="px-4 pb-3 pt-1 text-[10px] text-zinc-600 border-t border-line/50">
          Model probabilities, not guarantees. Entertainment — not betting advice.
        </p>
      </div>
    </div>
  );
}
