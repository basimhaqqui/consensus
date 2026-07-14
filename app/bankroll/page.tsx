import { notFound } from "next/navigation";
import Link from "next/link";
import bankrollFile from "../../data/bankroll.json";
import BankrollTickets, { type TicketBet } from "@/components/BankrollTickets";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bankroll — Consensus",
  robots: { index: false, follow: false },
};

type Bankroll = {
  start: number;
  target?: number;
  cash: number;
  bets: TicketBet[];
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
  const potential = open.reduce((a, b) => a + b.stake * b.odds, 0);
  const equity = s.cash + exposure;
  const pnl = equity - s.start;
  const wins = settled.filter((b) => b.status === "won").length;
  const target = s.target ?? 10000;
  const progress = Math.min(1, Math.max(0, equity / target));

  return (
    <main className="site-shell site-shell--compact">
      <header className="site-header flex items-end justify-between gap-4">
        <div>
          <div className="site-kicker">04 / Private ledger</div>
          <h1 className="site-title site-title--small">Model Bankroll</h1>
          <p className="site-subtitle max-w-2xl text-xs">
            ${s.start.toLocaleString()} paper stake · aim: at least ${target.toLocaleString()}, no
            deadline · full-Kelly staking, full market menu · settles on 90&apos; data
          </p>
        </div>
        <Link
          href="/wc"
          className="back-link shrink-0"
        >
          ← Terminal
        </Link>
      </header>

      <div className="mt-6">
        <div className="mb-1 flex justify-between text-[10px] uppercase tracking-wider text-muted">
          <span>Progress to ${target.toLocaleString()}</span>
          <span className="tabnums">{(progress * 100).toFixed(1)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full border border-[var(--hairline)] bg-black/40 shadow-[inset_0_1px_5px_rgba(0,0,0,0.6)]">
          <div
            className={`h-full ${equity >= s.start ? "bg-accent" : "bg-danger"}`}
            style={{ width: `${Math.max(1, progress * 100)}%` }}
          />
        </div>
      </div>

      <div className="terminal-kpi-grid mt-4 grid grid-cols-2 gap-px sm:grid-cols-4">
        {[
          ["Equity", `$${equity.toFixed(2)}`, pnl >= 0 ? "text-accent" : "text-danger"],
          ["P/L", `${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`, pnl >= 0 ? "text-accent" : "text-danger"],
          ["At risk → returns", `$${exposure.toFixed(0)} → $${potential.toFixed(0)}`, "text-text"],
          ["Record", settled.length ? `${wins}–${settled.length - wins}` : "—", "text-text"],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="terminal-kpi px-4 py-3">
            <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
            <div className={`mt-0.5 text-lg font-bold tabnums ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      <section className="mt-8">
        <div className="section-heading" data-index="01">
          <h2>
            Open tickets {open.length > 0 && <span className="text-accent">[{open.length}]</span>}
          </h2>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">tap a ticket for the reasoning</span>
        </div>
        <BankrollTickets bets={open} />
      </section>

      <section className="mt-8">
        <div className="section-heading" data-index="02">
          <h2>Settled</h2>
        </div>
        <BankrollTickets bets={settled} />
      </section>

      <section className="mt-8">
        <div className="section-heading" data-index="03">
          <h2>Activity</h2>
        </div>
        <div className="terminal-panel space-y-1 p-4 text-[11px] leading-relaxed text-muted">
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
      <Footer />
    </main>
  );
}
