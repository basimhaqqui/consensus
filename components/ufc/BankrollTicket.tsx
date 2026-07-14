"use client";

import { useState } from "react";

type Leg = { boutId: string; type: string; label: string; price: number; side?: string; point?: number; pickId?: string };
export type TicketBet = {
  kind: "single" | "parlay";
  title: string;
  legs: Leg[];
  stake: number;
  toWin: number;
  price: number;
  p: number;
  ev: number;
  event: string;
  analysis: string;
  placedAt: string;
  outcome?: "win" | "loss" | "void";
  payout?: number;
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const pc = (n: number) => `${(n * 100).toFixed(1)}%`;
const american = (price: number) =>
  price >= 2 ? `+${Math.round((price - 1) * 100)}` : `−${Math.round(100 / (price - 1))}`;

function sizingStory(b: TicketBet): string {
  const notes: string[] = [];
  if (b.analysis.includes("owner")) notes.push("Owner-ordered position — placed on instruction, not by the strategy's own trigger.");
  else if (b.p >= 0.7) notes.push(`Sized as a LOCK: ${pc(b.p)} win probability clears the 70% lock line, so it gets full-Kelly sizing with no cap — the largest stake that still maximizes long-run growth.`);
  else if (b.kind === "parlay") notes.push("Parlay sizing: fractional Kelly on the combined probability, deliberately smaller than singles because multiplied estimates multiply their errors too.");
  else notes.push(`Sized by fractional Kelly on a ${pc(Math.max(0, b.ev) )}-EV edge, with the $50 house floor.`);
  if (b.title.includes("top-up")) notes.push("Includes top-ups: the position was re-sized upward when the sizing rules got more aggressive.");
  return notes.join(" ");
}

export default function BankrollTicket({ b }: { b: TicketBet }) {
  const [open, setOpen] = useState(false);
  const implied = 1 / b.price;
  const edge = b.p - implied;

  return (
    <div
      onClick={() => setOpen((o) => !o)}
      className={`terminal-panel terminal-panel--interactive group cursor-pointer ${
        b.outcome === "win"
          ? "terminal-panel--win"
          : b.outcome === "loss"
            ? "terminal-panel--loss"
            : "hover:border-zinc-600"
      }`}
    >
      <div className="terminal-panel-header flex items-center justify-between gap-3 px-4 py-2 text-[9px] uppercase tracking-[0.17em] text-muted">
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              b.outcome === "win"
                ? "bg-accent shadow-[0_0_10px_rgba(52,211,153,0.55)]"
                : b.outcome === "loss"
                  ? "bg-danger shadow-[0_0_10px_rgba(248,113,113,0.45)]"
                  : "bg-blue shadow-[0_0_10px_rgba(59,130,246,0.45)]"
            }`}
          />
          <span className={b.kind === "parlay" ? "font-bold text-accent" : "text-zinc-400"}>
            {b.kind === "parlay" ? `${b.legs.length}-leg parlay` : "single position"}
          </span>
        </div>
        <span className="truncate text-right">{b.event.replace("UFC Fight Night: ", "FN: ")}</span>
      </div>
      <div className="p-4 sm:p-5">
        {b.kind === "parlay" ? (
          <div className="space-y-1">
            {b.legs.map((l) => (
              <div key={`${l.boutId}${l.label}`} className="display text-lg font-bold leading-tight text-zinc-100">
                {l.label} <span className="text-xs font-normal text-muted tabnums">@{l.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="display text-2xl font-extrabold leading-none text-zinc-100 group-hover:text-white">
            {b.legs[0].label}
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.12em] text-muted tabnums">
          <span>Model {pc(b.p)}</span>
          <span className="text-zinc-700">/</span>
          <span className={b.ev >= 0 ? "text-accent" : "text-danger"}>
            EV {b.ev >= 0 ? "+" : ""}{(b.ev * 100).toFixed(0)}%
          </span>
          <span className="text-zinc-700">/</span>
          <span className="normal-case tracking-normal text-zinc-600">
            {open ? "▾ reasoning open" : "▸ tap for reasoning"}
          </span>
        </div>

        <div className="terminal-kpi-grid mt-4 grid grid-cols-3 gap-px rounded-md">
          <TicketStat label="Stake" value={usd(b.stake)} />
          <TicketStat label="Odds" value={american(b.price)} sub={`@${b.price}`} />
          <TicketStat
            label={b.outcome && b.payout !== undefined ? "Payout" : "To win"}
            value={b.outcome && b.payout !== undefined ? usd(b.payout) : usd(b.toWin)}
            valueClass={
              b.outcome === "win"
                ? "text-accent"
                : b.outcome === "loss"
                  ? "text-danger"
                  : "text-emerald-400"
            }
          />
        </div>

        {b.outcome && (
          <div
            className={`mt-3 flex items-center justify-between rounded border px-3 py-2 ${
              b.outcome === "win"
                ? "border-accent/25 bg-accent/[0.07] text-accent"
                : b.outcome === "loss"
                  ? "border-danger/25 bg-danger/[0.07] text-danger"
                  : "border-zinc-700 bg-zinc-800/60 text-zinc-400"
            }`}
          >
            <span className="text-[9px] uppercase tracking-[0.17em]">Settlement</span>
            <span className="display text-lg font-extrabold uppercase tabnums">
              {b.outcome === "win"
                ? `Won +${usd((b.payout ?? 0) - b.stake)}`
                : b.outcome === "loss"
                  ? `Lost −${usd(b.stake)}`
                  : "Void"}
            </span>
          </div>
        )}

        {open && (
          <div className="mt-4 space-y-4 border-t border-line pt-4" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-accent">Why this pick</div>
              <ul className="space-y-1.5 text-xs leading-relaxed text-zinc-300">
                {b.analysis.split(" · ").map((line, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="shrink-0 text-zinc-600">▸</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-blue">The math</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs tabnums">
                <span className="text-muted">Our probability</span>
                <span className="text-right">{pc(b.p)}</span>
                <span className="text-muted">Price implies</span>
                <span className="text-right">{pc(implied)}</span>
                <span className="text-muted">Edge</span>
                <span className={`text-right ${edge > 0 ? "text-emerald-400" : "text-danger"}`}>
                  {edge > 0 ? "+" : ""}{(edge * 100).toFixed(1)} pts
                </span>
                <span className="text-muted">Fair price for our number</span>
                <span className="text-right">@{(1 / b.p).toFixed(2)} — got @{b.price}</span>
                <span className="text-muted">Expected value</span>
                <span className={`text-right ${b.ev >= 0 ? "text-emerald-400" : "text-danger"}`}>
                  {b.ev >= 0 ? "+" : ""}{(b.ev * 100).toFixed(1)}% per $1
                </span>
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[9px] uppercase tracking-[0.2em] text-warn">The sizing</div>
              <p className="text-xs leading-relaxed text-zinc-300">{sizingStory(b)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TicketStat({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="terminal-kpi min-w-0 px-2 py-2.5 text-center sm:px-3">
      <div className="text-[8px] uppercase tracking-[0.16em] text-muted">{label}</div>
      <div className={`display mt-0.5 truncate text-lg font-bold tabnums sm:text-xl ${valueClass}`}>
        {value}
      </div>
      {sub ? <div className="mt-0.5 text-[8px] text-zinc-600 tabnums">{sub}</div> : null}
    </div>
  );
}
