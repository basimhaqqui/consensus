export default function Footer() {
  return (
    <footer className="mt-20 border-t border-[var(--hairline)] pt-6 text-[10px] text-muted">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <span className="text-accent [text-shadow:0_0_14px_rgba(52,211,153,0.55)]">▸</span>
          <span className="uppercase tracking-[0.18em] text-zinc-300">
            Consensus
          </span>
          <span className="uppercase tracking-[0.14em] text-zinc-600">/ intelligence</span>
        </span>
        <span className="text-zinc-600 sm:text-right">
          A sports intelligence terminal · for entertainment, not betting advice
        </span>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-white/[0.035] pt-4 text-zinc-600">
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
