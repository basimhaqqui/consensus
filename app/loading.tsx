export default function Loading() {
  return (
    <main className="site-shell" aria-busy="true" aria-label="Loading Consensus">
      <div className="site-topbar">
        <div className="site-wordmark">
          <span>▸</span> CONSENSUS
        </div>
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          Loading intelligence
        </span>
      </div>

      <section className="site-header pb-7">
        <div className="state-skeleton state-skeleton--short" />
        <div className="state-skeleton state-skeleton--title" />
        <div className="state-skeleton state-skeleton--copy" />
      </section>

      <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
        <div className="terminal-panel min-h-80 p-5">
          <div className="state-skeleton state-skeleton--short" />
          <div className="mt-8 space-y-4">
            <div className="state-skeleton state-skeleton--row" />
            <div className="state-skeleton state-skeleton--row" />
            <div className="state-skeleton state-skeleton--row" />
          </div>
        </div>
        <div className="space-y-4">
          <div className="terminal-panel h-36 p-5">
            <div className="state-skeleton state-skeleton--short" />
            <div className="state-skeleton state-skeleton--copy" />
          </div>
          <div className="terminal-panel h-36 p-5">
            <div className="state-skeleton state-skeleton--short" />
            <div className="state-skeleton state-skeleton--copy" />
          </div>
        </div>
      </div>
      <span className="sr-only" role="status" aria-live="polite">
        Loading the latest sports intelligence.
      </span>
    </main>
  );
}
