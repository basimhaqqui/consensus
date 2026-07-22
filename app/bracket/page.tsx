import { getLiveMatches } from "@/lib/live";
import { getBracket } from "@/lib/bracket";
import BracketView from "@/components/BracketView";
import AutoRefresh from "@/components/AutoRefresh";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "World Cup 2026 Final Bracket — CONSENSUS",
  description: "The completed World Cup 2026 knockout bracket and final results.",
};

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
            <div className="site-kicker">Archive / tournament map</div>
            <h1 className="site-title">Final knockout bracket</h1>
          </div>
          <AutoRefresh updatedAt={updatedAt} />
        </div>
        <p className="site-subtitle">
          The completed knockout tree from the round of 32 through the final,
          preserved as part of the World Cup 2026 record.
        </p>
      </header>

      <div className="terminal-panel blueprint-surface mt-8 p-4 sm:p-6">
        <BracketView bracket={bracket} />
      </div>
      <Footer />
    </main>
  );
}
