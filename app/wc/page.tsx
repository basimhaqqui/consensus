import Link from "next/link";
import { getBoards } from "@/lib/live";
import { getStandings } from "@/lib/standings";
import { LAST_UPDATED, TEAMS } from "@/lib/data";
import LiveBoard from "@/components/LiveBoard";
import Nav from "@/components/Nav";
import CompetitionNav from "@/components/CompetitionNav";
import Standings from "@/components/Standings";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function WorldCup() {
  const [boards, groups] = await Promise.all([
    getBoards(),
    getStandings("fifa.world"),
  ]);
  const initial = { ...boards, updatedAt: new Date().toISOString() };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 pb-20">
      <div className="pt-5 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="text-sm font-bold tracking-tight flex items-center gap-1.5 shrink-0"
        >
          <span className="text-accent">▸</span> CONSENSUS
        </Link>
        <CompetitionNav active="fifa.world" />
      </div>

      <header className="pt-4 pb-2 border-b border-line">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              2026 World Cup
            </h1>
            <p className="mt-1 text-sm text-muted max-w-xl">
              Live scores plus our own model — win probability, to-advance odds,
              expected scoreline — for every knockout match, with a tournament
              simulator and bracket.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Nav />
            <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-muted">
              {LAST_UPDATED}
            </span>
          </div>
        </div>

        <LiveBoard initial={initial} />
      </header>

      {groups && groups.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              Group stage — final standings
            </h2>
            <span className="flex-1 h-px bg-line" />
          </div>
          <Standings groups={groups} highlightTop={2} />
        </section>
      )}

      <section className="mt-12 rounded-lg border border-line bg-panel/60 p-5 text-xs text-muted leading-relaxed">
        <h2 className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
          Methodology
        </h2>
        <p>
          <span className="text-zinc-400">Live scores &amp; status</span> stream
          from ESPN and auto-refresh every 30s. The{" "}
          <span className="text-zinc-400">forecast</span> is our own Elo rating
          (computed from 49,000+ real international results) fed through a Poisson
          goals model — win / draw / win, to-advance odds (incl. ET &amp; pens),
          expected goals, and the most likely scoreline. Toggle{" "}
          <span className="text-zinc-400">Market</span> to compare against the
          betting market. Each decided knockout match is graded{" "}
          <span className="text-accent">HIT</span> /{" "}
          <span className="text-danger">MISS</span> against the model&apos;s pick.
        </p>
        <p className="mt-3 text-[11px] text-zinc-600">
          For entertainment, not betting advice. Knockout football is
          high-variance — treat every number as a probability, not a promise.
        </p>
      </section>

      <Footer />
    </div>
  );
}
