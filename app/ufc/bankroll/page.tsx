import Link from "next/link";
import { notFound } from "next/navigation";
import bankrollJson from "@/data/ufc/bankroll.json";
import BankrollTicket from "@/components/ufc/BankrollTicket";

export const metadata = { title: "Bankroll — UFC CONSENSUS", robots: { index: false } };
export const dynamic = "force-dynamic";

type Leg = { boutId: string; type: string; label: string; price: number; side?: string; point?: number; pickId?: string };
type Bet = {
  kind: "single" | "parlay";
  title: string;
  legs: Leg[];
  stake: number;
  price: number;
  p: number;
  ev: number;
  event: string;
  analysis: string;
  placedAt: string;
  settledAt?: string;
  outcome?: "win" | "loss" | "void";
  payout?: number;
};

const state = bankrollJson as unknown as {
  start: number;
  cash: number;
  open: Bet[];
  settled: Bet[];
  curve: { at: string; cash: number; exposure: number }[];
};

const usd = (n: number) => `$${n.toFixed(2)}`;
const american = (price: number) =>
  price >= 2 ? `+${Math.round((price - 1) * 100)}` : `−${Math.round(100 / (price - 1))}`;

// Top-ups create several entries on one market — merge them into a single ticket.
function mergeTickets(bets: Bet[]): (Bet & { toWin: number })[] {
  const map = new Map<string, Bet & { toWin: number }>();
  for (const b of bets) {
    const key = b.outcome
      ? `${b.placedAt}-${b.title}` // settled: keep history as-is
      : b.legs.map((l) => `${l.boutId}:${l.type}:${l.side ?? ""}${l.point ?? ""}:${l.pickId ?? ""}`).join("|");
    const toWin = b.stake * (b.price - 1);
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...b, title: b.title.replace(" (top-up)", ""), toWin });
    } else {
      prev.stake = Math.round((prev.stake + b.stake) * 100) / 100;
      prev.toWin += toWin;
    }
  }
  return [...map.values()];
}

export default async function BankrollPage({
  searchParams,
}: {
  searchParams: Promise<{ key?: string }>;
}) {
  const { key } = await searchParams;
  if (!process.env.BANKROLL_KEY || key !== process.env.BANKROLL_KEY) notFound();

  const exposure = state.open.reduce((s, b) => s + b.stake, 0);
  const total = state.cash + exposure;
  const pnl = total - state.start;
  const settled = [...state.settled].reverse();
  const wins = settled.filter((b) => b.outcome === "win").length;
  const losses = settled.filter((b) => b.outcome === "loss").length;
  const staked = state.settled.reduce((s, b) => s + b.stake, 0);
  const returned = state.settled.reduce((s, b) => s + (b.payout ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <div className="pt-5">
        <Link href="/ufc" className="display text-base font-bold tracking-tight flex items-center gap-1.5">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </Link>
      </div>

      <header className="pt-8 pb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          Private experiment · paper money
        </div>
        <h1 className="display mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight">
          The Bankroll
        </h1>
        <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
          $1,000 of simulated money, bet automatically every data run at real average book
          prices: three-quarter-Kelly on consensus-probability edges (min +3% EV), moneylines and
          rounds totals, one parlay per card, near-debut fights excluded. Settled by real
          results. If the strategy has edge, this curve proves it — and if it doesn&apos;t,
          it proves that instead.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Bankroll" value={usd(total)} sub={`started ${usd(state.start)}`}
          valueClass={pnl >= 0 ? "text-emerald-400" : "text-danger"} />
        <Stat label="P&L" value={`${pnl >= 0 ? "+" : ""}${usd(pnl).replace("$-", "-$")}`}
          sub={staked > 0 ? `ROI ${(((returned - staked) / staked) * 100).toFixed(1)}%` : "no settled bets yet"}
          valueClass={pnl >= 0 ? "text-emerald-400" : "text-danger"} />
        <Stat
          label="In play"
          value={usd(exposure)}
          sub={`to win ${usd(state.open.reduce((s, b) => s + b.stake * (b.price - 1), 0))}`}
        />
        <Stat label="Record" value={settled.length ? `${wins}-${losses}` : "—"}
          sub={`${settled.length} settled`} />
      </section>

      <BetTable title="Open bets" bets={mergeTickets(state.open)} />
      <BetTable title="Settled" bets={mergeTickets(settled)} />

      <p className="mt-6 text-[10px] text-zinc-600">
        Simulation only — no real money is wagered anywhere. Prices are cross-book averages
        captured at bet time; a real bettor line-shopping would do slightly better, a real
        bettor moving size would do worse.
      </p>
    </div>
  );
}

function BetTable({ title, bets }: { title: string; bets: (Bet & { toWin: number })[] }) {
  if (!bets.length) return null;
  return (
    <section className="mt-8">
      <div className="mb-2 flex items-center gap-3">
        <h2 className="display text-base font-extrabold text-zinc-300">{title}</h2>
        <span className="text-[11px] text-muted">[{bets.length}]</span>
        <span className="flex-1 h-px bg-line" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {bets.map((b) => (
          <BankrollTicket key={`${b.placedAt}-${b.title}`} b={b} />
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, sub, valueClass = "" }: { label: string; value: string; sub: string; valueClass?: string }) {
  return (
    <div className="rounded-xl border border-line bg-panel/70 card-shadow p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 display text-2xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-muted tabnums">{sub}</div>
    </div>
  );
}
