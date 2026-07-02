export default function Footer() {
  return (
    <footer className="mt-12 border-t border-line pt-6 text-[11px] text-muted">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="text-accent">▸</span>
          <span className="uppercase tracking-[0.2em] text-zinc-400">
            Consensus
          </span>
          <span className="text-zinc-600">/ wc26</span>
        </span>
        <span className="text-zinc-600">
          A football intelligence terminal · for entertainment, not betting advice
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-zinc-600">
        <span>
          Live scores &amp; lineups <span className="text-zinc-500">ESPN</span>
        </span>
        <span>
          Ratings{" "}
          <span className="text-zinc-500">our Elo · 49k results</span>
        </span>
        <span>
          Player faces <span className="text-zinc-500">TheSportsDB</span>
        </span>
        <span>
          Bracket <span className="text-zinc-500">ESPN feeders</span>
        </span>
      </div>
    </footer>
  );
}
