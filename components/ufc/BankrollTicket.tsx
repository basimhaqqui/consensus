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
      className={`terminal-panel terminal-panel--interactive cursor-pointer transition-colors ${
        b.outcome === "win" ? "terminal-panel--win" : b.outcome === "loss" ? "terminal-panel--loss" : "hover:border-zinc-600"
      }`}
    >
      <div className="terminal-panel-header flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted">
        <span className={b.kind === "parlay" ? "text-accent font-bold" : ""}>
          {b.kind === "parlay" ? `${b.legs.length}-leg parlay` : "single"}
        </span>
        <span className="truncate pl-2">{b.event.replace("UFC Fight Night: ", "FN: ")}</span>
      </div>
      <div className="p-3">
        {b.kind === "parlay" ? (
          <div className="space-y-0.5">
            {b.legs.map((l) => (
              <div key={`${l.boutId}${l.label}`} className="display text-base font-extrabold leading-tight">
                {l.label} <span className="text-muted text-xs font-normal tabnums">@{l.price}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="display text-xl font-extrabold leading-tight">{b.legs[0].label}</div>
        )}
        <div className="mt-1 tabnums text-xs text-muted">
          @{b.price} ({american(b.price)}) · EV {b.ev >= 0 ? "+" : ""}{(b.ev * 100).toFixed(0)}%
          <span className="ml-2 text-zinc-600">{open ? "▾ reasoning" : "▸ tap for reasoning"}</span>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-center">
          <div className="terminal-kpi rounded-md px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted">Risk</div>
            <div className="tabnums text-lg font-bold">{usd(b.stake)}</div>
          </div>
          <div className="terminal-kpi rounded-md px-2 py-1.5">
            <div className="text-[9px] uppercase tracking-wider text-muted">To win</div>
            <div className="tabnums text-lg font-bold text-emerald-400">{usd(b.toWin)}</div>
          </div>
        </div>

        {b.outcome && (
          <div
            className={`mt-2 rounded-lg px-2 py-1.5 text-center display text-lg font-extrabold uppercase ${
              b.outcome === "win" ? "bg-emerald-400/15 text-emerald-400" : b.outcome === "loss" ? "bg-danger/15 text-danger" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {b.outcome === "win" ? `WON +${usd((b.payout ?? 0) - b.stake)}` : b.outcome === "loss" ? `LOST −${usd(b.stake)}` : "VOID"}
          </div>
        )}

        {open && (
          <div className="mt-3 space-y-3 border-t border-line pt-3" onClick={(e) => e.stopPropagation()}>
            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-accent mb-1">Why this pick</div>
              <ul className="space-y-1 text-xs text-zinc-300 leading-relaxed">
                {b.analysis.split(" · ").map((line, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="text-zinc-600 shrink-0">▸</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-blue mb-1">The math</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs tabnums">
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
              <div className="text-[9px] uppercase tracking-[0.2em] text-warn mb-1">The sizing</div>
              <p className="text-xs text-zinc-300 leading-relaxed">{sizingStory(b)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
