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
    <div>
      <header className="site-header site-header--compact">
        <div className="section-heading" data-index="01">
          <h2>Positions terminal</h2>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">private / paper capital</span>
        </div>

        <div className="terminal-panel">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-red to-transparent opacity-75" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-gradient-to-b from-transparent via-accent to-transparent opacity-65" />
          <div className="terminal-panel-header flex items-center justify-between gap-4 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted sm:px-6">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_rgba(52,211,153,0.65)]" />
              Strategy book
            </span>
            <span className="tabnums">UFC / simulated positions</span>
          </div>

          <div className="relative overflow-hidden px-5 py-7 sm:px-7 sm:py-9">
            <div className="pointer-events-none absolute -left-24 top-1/2 h-64 w-64 -translate-y-1/2 bg-[radial-gradient(circle,rgba(239,68,68,0.08),transparent_68%)]" />
            <div className="pointer-events-none absolute -right-24 top-1/2 h-64 w-64 -translate-y-1/2 bg-[radial-gradient(circle,rgba(52,211,153,0.08),transparent_68%)]" />
            <div className="relative max-w-4xl">
              <div className="site-kicker">Risk sized. Results settled.</div>
              <h1 className="site-title text-[clamp(2.8rem,8vw,5.7rem)] leading-[0.86] tracking-[-0.055em]">
                Bankroll
              </h1>
              <p className="site-subtitle max-w-3xl">
                $1,000 of simulated money, bet automatically every data run at real average book
                prices: three-quarter-Kelly on consensus-probability edges (min +3% EV), moneylines
                and rounds totals, one parlay per card, near-debut fights excluded. Settled by real
                results. If the strategy has edge, this curve proves it — and if it doesn&apos;t, it
                proves that instead.
              </p>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-10">
        <div className="section-heading" data-index="02">
          <h2>Performance</h2>
          <span className="text-[10px] uppercase tracking-[0.14em] text-muted">marked to current exposure</span>
        </div>
        <div className="terminal-kpi-grid grid grid-cols-2 gap-px lg:grid-cols-4">
          <Stat
            label="Bankroll"
            value={usd(total)}
            sub={`started ${usd(state.start)}`}
            valueClass={pnl >= 0 ? "text-emerald-400" : "text-danger"}
          />
          <Stat
            label="P&L"
            value={`${pnl >= 0 ? "+" : ""}${usd(pnl).replace("$-", "-$")}`}
            sub={
              staked > 0
                ? `ROI ${(((returned - staked) / staked) * 100).toFixed(1)}%`
                : "no settled bets yet"
            }
            valueClass={pnl >= 0 ? "text-emerald-400" : "text-danger"}
          />
          <Stat
            label="Open exposure"
            value={usd(exposure)}
            sub={`to win ${usd(state.open.reduce((s, b) => s + b.stake * (b.price - 1), 0))}`}
          />
          <Stat
            label="Record"
            value={settled.length ? `${wins}-${losses}` : "—"}
            sub={`${settled.length} settled`}
          />
        </div>
      </section>

      <BetTable index="03" title="Open tickets" bets={mergeTickets(state.open)} />
      <BetTable index="04" title="Settled" bets={mergeTickets(settled)} />

      <p className="mt-6 text-[10px] text-zinc-600">
        Simulation only — no real money is wagered anywhere. Prices are cross-book averages
        captured at bet time; a real bettor line-shopping would do slightly better, a real
        bettor moving size would do worse.
      </p>
    </div>
  );
}

function BetTable({
  index,
  title,
  bets,
}: {
  index: string;
  title: string;
  bets: (Bet & { toWin: number })[];
}) {
  return (
    <section className="mt-10">
      <div className="section-heading" data-index={index}>
        <h2>{title}</h2>
        <span className="text-[10px] text-muted tabnums">[{bets.length}]</span>
      </div>
      {bets.length === 0 ? (
        <div className="terminal-empty p-8 text-center text-sm">
          No {title.toLowerCase()} to display.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {bets.map((b) => (
            <BankrollTicket key={`${b.placedAt}-${b.title}`} b={b} />
          ))}
        </div>
      )}
    </section>
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
    <div className="terminal-kpi px-4 py-4 sm:px-5">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={`display mt-1 text-3xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600 tabnums">{sub}</div>
    </div>
  );
}
