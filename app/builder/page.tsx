import Link from "next/link";
import { getLiveMatches } from "@/lib/live";
import { matchProps } from "@/lib/props";
import { buildSuggestions } from "@/lib/suggestions";
import BetBuilder, { type BuilderMatch } from "@/components/BetBuilder";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bet Builder — Consensus",
  description:
    "Build a slip and price it against the model's fair odds — same-match combos priced off the joint score distribution.",
};

export default async function BuilderPage() {
  const { matches } = await getLiveMatches();
  const scheduled = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  const props = await matchProps(
    scheduled.map((m) => ({ id: m.id, homeKey: m.homeKey, awayKey: m.awayKey }))
  );
  const upcoming: BuilderMatch[] = scheduled.map((m) => ({
    id: m.id,
    date: m.date,
    homeCode: m.home.code,
    awayCode: m.away.code,
    homeFlag: m.home.flag,
    awayFlag: m.away.flag,
    lambdaHome: m.outcome.lambdaHome,
    lambdaAway: m.outcome.lambdaAway,
    players: props[m.id] ?? [],
  }));
  const suggestions = buildSuggestions(
    scheduled.map((m) => ({
      id: m.id,
      homeCode: m.home.code,
      awayCode: m.away.code,
      lambdaHome: m.outcome.lambdaHome,
      lambdaAway: m.outcome.lambdaAway,
      market: m.market
        ? { pHome: m.market.pHome, pDraw: m.market.pDraw, pAway: m.market.pAway }
        : null,
      players: props[m.id] ?? [],
    }))
  );

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <header className="pt-8 pb-5 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            <span className="text-accent">▸</span> Bet Builder
          </h1>
          <Link
            href="/wc"
            className="text-[11px] uppercase tracking-wider text-muted hover:text-text"
          >
            ← Terminal
          </Link>
        </div>
        <p className="mt-2 text-sm text-muted max-w-2xl">
          Build a slip across the remaining World Cup matches and see what it&apos;s
          actually worth. Fair odds come straight from the Consensus model — and
          same-match combos are priced off the joint score distribution, where
          books hide their biggest margins.
        </p>
      </header>

      <div className="mt-6">
        {upcoming.length === 0 ? (
          <div className="rounded-xl border border-line bg-panel/50 p-8 text-center text-sm text-muted">
            No upcoming matches to build with right now.
          </div>
        ) : (
          <BetBuilder matches={upcoming} suggestions={suggestions} />
        )}
      </div>

      <Footer />
    </div>
  );
}
