import { getLiveMatches } from "@/lib/live";
import { getBracket } from "@/lib/bracket";
import BracketView from "@/components/BracketView";
import AutoRefresh from "@/components/AutoRefresh";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

export default async function BracketPage() {
  const { matches } = await getLiveMatches();
  const bracket = getBracket(matches);
  const updatedAt = Date.now();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20">
      <header className="pt-8 pb-5 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-accent">▸</span> CONSENSUS
            <span className="text-muted font-normal text-base">/ bracket</span>
          </h1>
          <Nav />
        </div>
        <p className="mt-2 text-sm text-muted max-w-xl">
          The full knockout tree, filling in live as results land. Decided games
          show the winner advancing; later rounds resolve as their feeders finish.
        </p>
        <div className="mt-3">
          <AutoRefresh updatedAt={updatedAt} />
        </div>
      </header>

      <div className="mt-6">
        <BracketView bracket={bracket} />
      </div>
    </div>
  );
}
