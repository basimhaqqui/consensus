"use client";

import { useState } from "react";
import type { SimRow } from "@/lib/bracket";
import Crest from "./Crest";

const TOP = 10;

function p(n: number) {
  if (n >= 0.9995) return "✓";
  if (n <= 0) return "·";
  const v = n * 100;
  if (v < 1) return "<1";
  return `${Math.round(v)}`;
}

function champPct(n: number) {
  const v = n * 100;
  if (v <= 0) return "<0.1%";
  if (v < 10) return `${v.toFixed(1)}%`;
  return `${Math.round(v)}%`;
}

// Round columns drop off automatically once they carry no information —
// when every listed team is decided for that round (all ✓ or ·), showing
// it is just noise (e.g. R16 once the Round of 32 is complete).
const ROUNDS: { label: string; get: (r: SimRow) => number }[] = [
  { label: "R16", get: (r) => r.r16 },
  { label: "QF", get: (r) => r.qf },
  { label: "SF", get: (r) => r.sf },
  { label: "Fin", get: (r) => r.final },
];

// Tailwind needs literal class strings — one grid variant per column count,
// with and without the Next column.
const GRID = [
  "sm:grid-cols-[1.4fr_3fr]",
  "sm:grid-cols-[1.4fr_3fr_2.4rem]",
  "sm:grid-cols-[1.4fr_3fr_repeat(2,2.4rem)]",
  "sm:grid-cols-[1.4fr_3fr_repeat(3,2.4rem)]",
  "sm:grid-cols-[1.4fr_3fr_repeat(4,2.4rem)]",
];
const GRID_NEXT = [
  "sm:grid-cols-[1.4fr_3fr_5.5rem]",
  "sm:grid-cols-[1.4fr_3fr_5.5rem_2.4rem]",
  "sm:grid-cols-[1.4fr_3fr_5.5rem_repeat(2,2.4rem)]",
  "sm:grid-cols-[1.4fr_3fr_5.5rem_repeat(3,2.4rem)]",
  "sm:grid-cols-[1.4fr_3fr_5.5rem_repeat(4,2.4rem)]",
];

// subtle movement suffix on the title odds — only when it actually moved
function Delta({ d }: { d?: number }) {
  if (d === undefined || Math.abs(d) < 0.01) return null;
  const up = d > 0;
  return (
    <span className={`ml-1 text-[10px] ${up ? "text-accent" : "text-danger"}`}>
      {up ? "▲" : "▼"}
      {Math.abs(Math.round(d * 100))}
    </span>
  );
}

export default function TitleRace({ rows }: { rows: SimRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const max = Math.max(...rows.map((r) => r.champ), 0.001);
  const shown = expanded ? rows : rows.slice(0, TOP);
  const hidden = rows.length - TOP;

  const rounds = ROUNDS.filter((c) =>
    rows.some((r) => c.get(r) > 0 && c.get(r) < 0.9995)
  );
  const hasNext = rows.some((r) => r.next);
  const grid = `grid grid-cols-[1fr_auto] ${
    (hasNext ? GRID_NEXT : GRID)[rounds.length]
  } gap-2 px-4`;

  return (
    <div className="terminal-panel">
      {/* header */}
      <div className={`${grid} terminal-panel-header py-2 text-[9px] uppercase tracking-[0.14em] text-muted`}>
        <span>Team</span>
        <span className="hidden sm:block">Win title</span>
        {hasNext && <span className="hidden sm:block text-right">Next</span>}
        {rounds.map((c) => (
          <span key={c.label} className="hidden sm:block text-right">
            {c.label}
          </span>
        ))}
        <span className="sm:hidden text-right">Win</span>
      </div>

      <div className="divide-y divide-line/60">
        {shown.map((r, i) => (
          <div key={r.key}>
            <button
              type="button"
              onClick={() => setOpen(open === r.key ? null : r.key)}
              className={`${grid} w-full items-center py-2 text-left text-sm transition-colors hover:bg-white/[0.025]`}
            >
              {/* team */}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs text-muted w-4 tabnums text-right">
                  {i + 1}
                </span>
                <Crest teamKey={r.key} code={r.key} size={18} />
                <span className="truncate">{r.name}</span>
              </div>

              {/* champ bar (desktop) */}
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex-1 h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full ${
                      i === 0 ? "bg-accent" : i < 4 ? "bg-accent/70" : "bg-accent/40"
                    }`}
                    style={{ width: `${Math.max(2, (r.champ / max) * 100)}%` }}
                  />
                </div>
                <span className="tabnums text-xs w-[4.5rem] text-right text-text">
                  {champPct(r.champ)}
                  <Delta d={r.dChamp} />
                </span>
              </div>

              {/* next tie (desktop) */}
              {hasNext && (
                <span className="hidden sm:block tabnums text-right text-xs text-muted">
                  {r.next ? (
                    <>
                      <span className="text-zinc-600">v</span> {r.next.opp}{" "}
                      <span className={r.next.live ? "text-accent" : "text-zinc-400"}>
                        {Math.round(r.next.p * 100)}%
                      </span>
                    </>
                  ) : (
                    "·"
                  )}
                </span>
              )}

              {/* round columns (desktop) — only rounds still in play */}
              {rounds.map((c) => (
                <span
                  key={c.label}
                  className="hidden sm:block tabnums text-right text-xs text-muted"
                >
                  {p(c.get(r))}
                </span>
              ))}

              {/* champ only (mobile) */}
              <span className="sm:hidden tabnums text-right text-xs text-accent">
                {champPct(r.champ)}
                <Delta d={r.dChamp} />
              </span>
            </button>

            {/* the path — likely opponents per remaining round */}
            {open === r.key && r.path && r.path.length > 0 && (
              <div className="px-4 pb-2 pt-0.5 pl-[3.25rem] text-[11px] text-muted space-y-0.5">
                {r.path.map((pr) => (
                  <div key={pr.round} className="flex items-baseline gap-2 tabnums">
                    <span className="w-8 shrink-0 uppercase tracking-wider text-zinc-500">
                      {pr.round}
                    </span>
                    <span>
                      {pr.opps.map((o, j) => (
                        <span key={o.key}>
                          {j > 0 && <span className="text-zinc-600"> · </span>}
                          <span className="text-zinc-300">{o.key}</span>{" "}
                          {o.p >= 0.9995 ? "" : `${Math.round(o.p * 100)}%`}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {hidden > 0 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted hover:text-text hover:bg-panel2/50 border-t border-line transition-colors flex items-center justify-center gap-1.5"
        >
          {expanded ? (
            <>Show top {TOP} ▲</>
          ) : (
            <>Show all {rows.length} teams ({hidden} more) ▼</>
          )}
        </button>
      )}

      <div className="px-4 py-2 text-[10px] text-muted border-t border-line">
        Win% = championship odds across 10,000 simulated bracket runs
        {rounds.length > 0 && (
          <> · {rounds.map((c) => c.label).join("/")} = odds to reach that round · decided teams show ✓</>
        )}
      </div>
    </div>
  );
}
