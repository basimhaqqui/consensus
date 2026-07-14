"use client";

import { useState } from "react";

export type TicketBet = {
  matchId: string;
  placedAt: string;
  desc: string;
  stake: number;
  odds: number;
  status: "open" | "won" | "lost";
  result?: string;
  pnl?: number;
  analysis?: string;
  modelP?: number;
  ev?: number;
  edge?: number;
};

const money = (n: number) =>
  `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parts(desc: string) {
  const m = desc.match(/^(.*) @ [\d.]+ \(([^)]+)\)$/);
  return { title: m ? m[1] : desc, match: m ? m[2] : "" };
}

function Ticket({ b }: { b: TicketBet }) {
  const [open, setOpen] = useState(false);
  const { title, match } = parts(b.desc);
  const payout = b.stake * b.odds;
  const stripe =
    b.status === "won" ? "bg-accent" : b.status === "lost" ? "bg-danger" : "bg-sky-400/70";

  return (
    <button
      onClick={() => setOpen(!open)}
      className="terminal-panel terminal-panel--interactive w-full text-left"
    >
      <div className="flex items-stretch">
        <div className={`w-1 shrink-0 ${stripe}`} />
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 text-[10px] uppercase tracking-wider text-muted">
            <span>{match}</span>
            <span>
              {b.status === "open"
                ? b.placedAt.slice(5, 10)
                : b.status === "won"
                ? "WON"
                : "LOST"}
            </span>
          </div>

          <div className="mt-1 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-sm font-semibold text-zinc-100">{title}</span>
              <span className="ml-2 tabnums text-sm text-muted">@ {b.odds}</span>
            </div>
            <span className="shrink-0 text-[10px] text-zinc-600">{open ? "▲" : "▼"}</span>
          </div>

          {(b.modelP !== undefined || b.ev !== undefined) && (
            <div className="mt-1 text-[10px] text-muted">
              {b.modelP !== undefined && <>model {(b.modelP * 100).toFixed(0)}%</>}
              {b.ev !== undefined && <> · EV +{(b.ev * 100).toFixed(0)}%</>}
              {b.result && <> · final {b.result}</>}
            </div>
          )}

          <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-line/60 pt-2 tabnums">
            <span className="text-xs text-muted">
              Risk <span className="text-sm font-semibold text-zinc-200">{money(b.stake)}</span>
            </span>
            {b.status === "open" ? (
              <span className="text-xs text-muted">
                Returns{" "}
                <span className="text-sm font-bold text-accent">{money(payout)}</span>
              </span>
            ) : (
              <span
                className={`text-sm font-bold ${
                  b.status === "won" ? "text-accent" : "text-danger"
                }`}
              >
                {b.status === "won" ? "+" : "−"}
                {money(Math.abs(b.pnl ?? b.stake))}
              </span>
            )}
          </div>

          {open && (
            <div className="mt-2.5 border-t border-line/60 pt-2.5">
              <div className="mb-1 text-[9px] uppercase tracking-[0.2em] text-zinc-500">
                Why the model took it
              </div>
              <p className="text-[11px] leading-relaxed text-zinc-400">
                {b.analysis ?? "No written analysis for this ticket."}
              </p>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

export default function BankrollTickets({ bets }: { bets: TicketBet[] }) {
  if (!bets.length) return <p className="text-xs text-muted">Nothing here yet.</p>;
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 items-start">
      {bets.map((b, i) => (
        <Ticket key={`${b.matchId}-${i}`} b={b} />
      ))}
    </div>
  );
}
