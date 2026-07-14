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
    <main className="site-shell site-shell--match">
      <header className="site-header">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="site-kicker">03 / Model workspace</div>
            <h1 className="site-title site-title--small">Bet Builder</h1>
          </div>
          <Link
            href="/wc"
            className="back-link"
          >
            ← Terminal
          </Link>
        </div>
        <p className="site-subtitle">
          Build a slip across the remaining World Cup matches and see what it&apos;s
          actually worth. Fair odds come straight from the Consensus model — and
          same-match combos are priced off the joint score distribution, where
          books hide their biggest margins.
        </p>
      </header>

      <div className="mt-6">
        {upcoming.length === 0 ? (
          <div className="terminal-empty p-8 text-center text-sm">
            No upcoming matches to build with right now.
          </div>
        ) : (
          <BetBuilder matches={upcoming} suggestions={suggestions} />
        )}
      </div>

      <Footer />
    </main>
  );
}
