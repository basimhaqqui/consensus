import type { Metadata } from "next";
import Link from "next/link";
import { getBoards } from "@/lib/live";
import { getStandings } from "@/lib/standings";
import { fetchNews } from "@/lib/news";
import NewsPanel from "@/components/NewsPanel";
import { ledgerSummary } from "@/lib/ledger";
import { LAST_UPDATED, TEAMS } from "@/lib/data";
import LiveBoard from "@/components/LiveBoard";
import Nav from "@/components/Nav";
import CompetitionNav from "@/components/CompetitionNav";
import Standings from "@/components/Standings";
import Footer from "@/components/Footer";
import BestPerformers from "@/components/BestPerformers";
import { getCompetitionPerformance } from "@/lib/competition";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "World Cup 2026 Archive — CONSENSUS",
  description:
    "The complete World Cup 2026 record: final bracket, forecasts, best performers, standings, and the public prediction ledger.",
  alternates: { canonical: "/wc" },
  openGraph: {
    title: "World Cup 2026 Archive — CONSENSUS",
    description:
      "Final results, calibrated forecasts, best performers, and the public prediction ledger.",
    type: "website",
    url: "/wc",
    siteName: "CONSENSUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "World Cup 2026 Archive — CONSENSUS",
    description:
      "The completed tournament, preserved with every forecast and result.",
  },
};

export default async function WorldCup() {
  const performance = getCompetitionPerformance();
  const [boards, groups, news] = await Promise.all([
    getBoards(),
    getStandings("fifa.world"),
    fetchNews(),
  ]);
  const initial = { ...boards, updatedAt: new Date().toISOString() };

  return (
    <main className="site-shell">
      <div className="site-topbar">
        <Link
          href="/"
          className="site-wordmark"
        >
          <span className="text-accent">▸</span> CONSENSUS
        </Link>
        <CompetitionNav active="fifa.world" />
      </div>

      <header className="site-header pb-5">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="site-kicker">Archive / tournament complete</div>
            <h1 className="site-title">
              2026 World Cup
            </h1>
            <p className="site-subtitle">
              The completed tournament preserved as it happened: every knockout
              forecast, final result, simulation, performer, and graded call.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/bracket"
              className="rounded-[7px] border border-accent/40 bg-accent/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] text-accent shadow-[0_12px_30px_-18px_rgba(52,211,153,0.7)] hover:-translate-y-0.5 hover:border-accent/70 hover:bg-accent/15"
            >
              Final bracket
            </Link>
            <Nav hideUfc />
            <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-muted">
              {LAST_UPDATED}
            </span>
          </div>
        </div>

        <nav
          aria-label="World Cup sections"
          className="segmented-control mt-6 flex w-full items-center gap-0.5 overflow-x-auto p-0.5 text-[10px] uppercase tracking-[0.14em]"
        >
          <a href="#today" className="shrink-0 rounded-[6px] bg-accent/12 px-3 py-1.5 text-accent">
            Closeout
          </a>
          <a href="#forecasts" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Forecasts
          </a>
          <a href="#matches" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Matches
          </a>
          <a href="#performers" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Performers
          </a>
          <Link href="/bracket" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Bracket ↗
          </Link>
          <a href="#standings" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Standings
          </a>
          <a href="#ledger" className="shrink-0 rounded-[6px] px-3 py-1.5 text-muted hover:bg-white/[0.035] hover:text-text">
            Ledger
          </a>
        </nav>
      </header>

      <LiveBoard initial={initial} archived />

      <section id="performers" className="mt-12 scroll-mt-6">
        <div className="section-heading" data-index="05">
          <h2>Best performers</h2>
        </div>
        <BestPerformers view={performance} />
      </section>

      {groups && groups.length > 0 && (
        <section id="standings" className="mt-12 scroll-mt-6">
          <div className="section-heading" data-index="06">
            <h2>
              Group stage — final standings
            </h2>
          </div>
          <Standings groups={groups} highlightTop={2} />
        </section>
      )}

      <NewsPanel items={news} index="07" />

      <LedgerPanel />

      <section className="terminal-panel mt-12 p-5 text-xs leading-relaxed text-muted">
        <h2 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          Methodology
        </h2>
        <p>
          <span className="text-zinc-400">Scores &amp; results</span> were captured
          from ESPN throughout the tournament. The{" "}
          <span className="text-zinc-400">forecast</span>{" "}is our own Elo rating
          (computed from 49,000+ real international results) fed through a Poisson
          goals model — win / draw / win, to-advance odds (incl. ET &amp; pens),
          expected goals, and the most likely scoreline. Toggle{" "}
          <span className="text-zinc-400">Market</span> to compare against the
          betting market. Each decided knockout match is graded{" "}
          <span className="text-accent">HIT</span> /{" "}
          <span className="text-danger">MISS</span>{" "}against the model&apos;s pick.
        </p>
        <p className="mt-3 text-[11px] text-zinc-600">
          For entertainment, not betting advice. Knockout football is
          high-variance — treat every number as a probability, not a promise.
        </p>
      </section>

      <Footer />
    </main>
  );
}

// Auditable track record: forecasts are snapshotted before kickoff into a
// git-committed ledger, then graded against results. Lower log loss = better
// probabilities, not just better picks.
function LedgerPanel() {
  const s = ledgerSummary();
  if (s.graded === 0) return null;
  const row = (
    label: string,
    sc: { n: number; hits: number; logloss: number }
  ) =>
    sc.n === 0 ? null : (
      <div className="flex items-center justify-between tabnums">
        <span className="text-zinc-400">{label}</span>
        <span>
          {sc.hits}/{sc.n} picks · log loss {sc.logloss.toFixed(3)}
        </span>
      </div>
    );
  return (
    <section id="ledger" className="mt-12 scroll-mt-6">
      <div className="section-heading" data-index="08">
        <h2>
          Prediction ledger — graded pre-match forecasts
        </h2>
        <span className="text-[11px] text-muted">[{s.graded}]</span>
      </div>
      <div className="terminal-panel space-y-1.5 p-5 text-xs text-muted">
        {row("Consensus", s.blend)}
        {row("Our model", s.model)}
        {row("Books", s.market)}
        <p className="pt-2 text-[11px] text-zinc-600">
          Every forecast is committed to the repo before kickoff and graded
          after the final whistle — the git history is the receipt.
        </p>
      </div>
    </section>
  );
}
