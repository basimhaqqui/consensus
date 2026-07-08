import { notFound } from "next/navigation";
import Link from "next/link";
import bankrollFile from "../../data/bankroll.json";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bankroll — Consensus",
  robots: { index: false, follow: false },
};

type Bet = {
  matchId: string;
  placedAt: string;
  desc: string;
  analysis?: string;
  stake: number;
  odds: number;
  edge?: number;
  ev?: number;
  modelP: number;
  booksP?: number;
  status: "open" | "won" | "lost";
  settledAt?: string;
  result?: string;
  pnl?: number;
};

type Bankroll = {
  start: number;
  target?: number;
  cash: number;
  bets: Bet[];
  log: { at: string; msg: string }[];
};

export default async function BankrollPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k } = await searchParams;
  const key = process.env.BANKROLL_KEY;
  if (!key || k !== key) notFound();

  const s = bankrollFile as unknown as Bankroll;
  const open = s.bets.filter((b) => b.status === "open");
  const settled = s.bets.filter((b) => b.status !== "open").reverse();
  const exposure = open.reduce((a, b) => a + b.stake, 0);
  const equity = s.cash + exposure;
  const pnl = equity - s.start;
  const wins = settled.filter((b) => b.status === "won").length;
  const target = s.target ?? 10000;
  const progress = Math.min(1, Math.max(0, equity / target));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-20">
      <header className="pt-8 pb-5 border-b border-line flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="text-accent">▸</span> Model Bankroll
          </h1>
          <p className="mt-1 text-xs text-muted">
            ${s.start.toLocaleString()} paper stake · aim: at least ${target.toLocaleString()}, no
            deadline · full-Kelly staking, full market menu · settles on 90&apos; data
          </p>
        </div>
        <Link
          href="/wc"
          className="text-[11px] uppercase tracking-wider text-muted hover:text-text"
        >
          ← Terminal
        </Link>
      </header>

      <div className="mt-6">
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted">
          <span>Progress to ${target.toLocaleString()}</span>
          <span className="tabnums">{(progress * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 rounded-full bg-zinc-800 overflow-hidden border border-line">
          <div
            className={`h-full ${equity >= s.start ? "bg-accent" : "bg-danger"}`}
            style={{ width: `${Math.max(1, progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-px bg-line rounded-lg overflow-hidden border border-line card-shadow">
        {[
          ["Equity", `$${equity.toFixed(2)}`, pnl >= 0 ? "text-accent" : "text-danger"],
          ["P/L", `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`, pnl >= 0 ? "text-accent" : "text-danger"],
          ["Cash / At risk", `$${s.cash.toFixed(2)} / $${exposure.toFixed(2)}`, "text-text"],
          ["Record", settled.length ? `${wins}–${settled.length - wins}` : "—", "text-text"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="bg-panel px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
            <div className={`mt-0.5 text-lg font-bold tabnums ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {open.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Open bets
          </h2>
          <div className="divide-y divide-line rounded-xl border border-line bg-panel card-shadow text-xs">
            {open.map((b) => (
              <div key={b.matchId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-zinc-200">{b.desc}</div>
                  <div className="text-[10px] text-muted">
                    model {(b.modelP * 100).toFixed(0)}%
                    {b.ev !== undefined && <> · EV +{(b.ev * 100).toFixed(0)}%</>}
                    {b.edge !== undefined && <> · edge +{(b.edge * 100).toFixed(0)}</>}
                  </div>
                  {b.analysis && (
                    <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-400">
                      {b.analysis}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right tabnums">
                  <div className="text-zinc-200">${b.stake.toFixed(2)}</div>
                  <div className="text-[10px] text-muted">→ ${(b.stake * b.odds).toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          Settled
        </h2>
        {settled.length === 0 ? (
          <p className="text-xs text-muted">Nothing settled yet.</p>
        ) : (
          <div className="divide-y divide-line rounded-xl border border-line bg-panel card-shadow text-xs">
            {settled.map((b) => (
              <div key={b.matchId} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <div className="text-zinc-200">{b.desc}</div>
                  <div className="text-[10px] text-muted">final {b.result}</div>
                  {b.analysis && (
                    <p className="mt-1.5 max-w-md text-[11px] leading-relaxed text-zinc-500">
                      {b.analysis}
                    </p>
                  )}
                </div>
                <div
                  className={`shrink-0 tabnums font-semibold ${
                    b.status === "won" ? "text-accent" : "text-danger"
                  }`}
                >
                  {b.status === "won" ? "+" : "−"}${Math.abs(b.pnl ?? 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-2 text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          Activity
        </h2>
        <div className="rounded-xl border border-line bg-panel/60 p-4 text-[11px] leading-relaxed text-muted space-y-1">
          {s.log.slice(-12).reverse().map((l, i) => (
            <div key={i}>
              <span className="text-zinc-600">{l.at.slice(5, 16).replace("T", " ")}</span>{" "}
              {l.msg}
            </div>
          ))}
        </div>
      </section>

      <p className="mt-8 text-[10px] text-zinc-600">
        Paper money. An experiment in whether the model&apos;s edges survive real
        prices — not betting advice.
      </p>
    </div>
  );
}
