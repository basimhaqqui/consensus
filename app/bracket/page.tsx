import { getLiveMatches } from "@/lib/live";
import { getBracket } from "@/lib/bracket";
import BracketView from "@/components/BracketView";
import AutoRefresh from "@/components/AutoRefresh";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const { matches } = await getLiveMatches();
  const bracket = getBracket(matches);
  const updatedAt = Date.now();

  return (
    <main className="site-shell">
      <div className="site-topbar">
        <span className="site-wordmark">
          <span>▸</span> CONSENSUS
        </span>
        <Nav />
      </div>
      <header className="site-header">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="site-kicker">02 / Tournament map</div>
            <h1 className="site-title">Knockout bracket</h1>
          </div>
          <AutoRefresh updatedAt={updatedAt} />
        </div>
        <p className="site-subtitle">
          The full knockout tree, filling in live as results land. Decided games
          show the winner advancing; later rounds resolve as their feeders finish.
        </p>
      </header>

      <div className="terminal-panel blueprint-surface mt-8 p-4 sm:p-6">
        <BracketView bracket={bracket} />
      </div>
      <Footer />
    </main>
  );
}
