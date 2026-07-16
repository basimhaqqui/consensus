import Link from "next/link";

export default function NotFound() {
  return (
    <main className="site-shell site-shell--compact">
      <div className="site-topbar">
        <Link href="/" className="site-wordmark">
          <span>▸</span> CONSENSUS
        </Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-zinc-600">
          404 / No signal
        </span>
      </div>

      <section className="state-page">
        <div className="site-kicker">Unknown route / 404</div>
        <h1 className="site-title site-title--small">Nothing is broadcasting here.</h1>
        <p className="site-subtitle">
          The match, fighter, or desk may have moved. Continue from a live
          product surface.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/signals" className="action-primary">
            Today&apos;s signals
          </Link>
          <Link href="/wc" className="action-secondary">
            World Cup
          </Link>
          <Link href="/ufc" className="action-secondary">
            UFC
          </Link>
        </div>
      </section>
    </main>
  );
}
