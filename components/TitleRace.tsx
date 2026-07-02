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

export default function TitleRace({ rows }: { rows: SimRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const max = Math.max(...rows.map((r) => r.champ), 0.001);
  const shown = expanded ? rows : rows.slice(0, TOP);
  const hidden = rows.length - TOP;

  return (
    <div className="rounded-lg border border-line bg-panel/70 overflow-hidden card-shadow">
      {/* header */}
      <div className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_3fr_repeat(4,2.4rem)] gap-2 px-4 py-2 border-b border-line bg-panel2/60 text-[10px] uppercase tracking-wider text-muted">
        <span>Team</span>
        <span className="hidden sm:block">Win title</span>
        <span className="hidden sm:block text-right">R16</span>
        <span className="hidden sm:block text-right">QF</span>
        <span className="hidden sm:block text-right">SF</span>
        <span className="hidden sm:block text-right">Fin</span>
        <span className="sm:hidden text-right">Win</span>
      </div>

      <div className="divide-y divide-line/60">
        {shown.map((r, i) => (
          <div
            key={r.key}
            className="grid grid-cols-[1fr_auto] sm:grid-cols-[1.4fr_3fr_repeat(4,2.4rem)] gap-2 px-4 py-1.5 items-center text-sm hover:bg-panel2/40"
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
              <span className="tabnums text-xs w-12 text-right text-text">
                {champPct(r.champ)}
              </span>
            </div>

            {/* round columns (desktop) */}
            <span className="hidden sm:block tabnums text-right text-xs text-muted">
              {p(r.r16)}
            </span>
            <span className="hidden sm:block tabnums text-right text-xs text-muted">
              {p(r.qf)}
            </span>
            <span className="hidden sm:block tabnums text-right text-xs text-muted">
              {p(r.sf)}
            </span>
            <span className="hidden sm:block tabnums text-right text-xs text-muted">
              {p(r.final)}
            </span>

            {/* champ only (mobile) */}
            <span className="sm:hidden tabnums text-right text-xs text-accent">
              {champPct(r.champ)}
            </span>
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
        Win% = championship odds across 10,000 simulated bracket runs · R16/QF/SF/Fin
        = odds to reach that round · decided teams show ✓
      </div>
    </div>
  );
}
