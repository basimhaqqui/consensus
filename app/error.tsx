"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="site-shell site-shell--compact">
      <div className="site-topbar">
        <Link href="/" className="site-wordmark">
          <span>▸</span> CONSENSUS
        </Link>
        <span className="text-[10px] uppercase tracking-[0.16em] text-danger">
          Feed interrupted
        </span>
      </div>

      <section className="state-page" role="alert">
        <div className="site-kicker">Recovery protocol / 01</div>
        <h1 className="site-title site-title--small">The desk lost its feed.</h1>
        <p className="site-subtitle">
          Your saved items are safe. Retry the request, or return to the main
          intelligence desk while the data source recovers.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <button type="button" onClick={unstable_retry} className="action-primary">
            Retry feed
          </button>
          <Link href="/" className="action-secondary">
            Return home
          </Link>
        </div>
        {error.digest && (
          <p className="mt-8 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
            Incident reference · {error.digest}
          </p>
        )}
      </section>
    </main>
  );
}
