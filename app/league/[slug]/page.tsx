import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getLeagueScoreboard,
  competitionBySlug,
  type LeagueMatch,
} from "@/lib/leagues";
import { getStandings, ratingMap } from "@/lib/standings";
import { forecast, inPlay, MU_CLUB } from "@/lib/model";
import {
  getRemainingFixtures,
  priorSeasonRatings,
  projectSeason,
  qualStructure,
} from "@/lib/projection";
import { applyZoneNotes, zoneCounts } from "@/lib/qualification";
import Crest from "@/components/Crest";
import CompetitionNav from "@/components/CompetitionNav";
import Standings from "@/components/Standings";
import LeagueProjection from "@/components/LeagueProjection";
import AutoRefresh from "@/components/AutoRefresh";

export const dynamic = "force-dynamic";

export default async function LeaguePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const comp = competitionBySlug(slug);
  if (!comp) notFound();

  const [board, rawStandings] = await Promise.all([
    getLeagueScoreboard(slug),
    getStandings(slug),
  ]);
  const matches = board?.matches ?? [];

  // Paint European/relegation zones onto the table once it's positional
  // (pre-season tables are alphabetical, so colouring them would mislead).
  const tableMaxGp = rawStandings
    ? Math.max(0, ...rawStandings.flatMap((g) => g.rows.map((r) => r.gp)))
    : 0;
  const standings =
    rawStandings && tableMaxGp > 0
      ? applyZoneNotes(slug, rawStandings)
      : rawStandings;
  const rmap = standings ? ratingMap(standings) : new Map<string, number>();

  // season projection — single-table leagues (mid-season, pre-season, or finished)
  let projection: Awaited<ReturnType<typeof buildProjection>> = null;
  if (standings && standings.length === 1) {
    projection = await buildProjection(slug, standings[0].rows, rmap);
  }

  // group by date
  const groups = new Map<string, LeagueMatch[]>();
  for (const m of matches) {
    const day = m.dateISO.slice(0, 10);
    (groups.get(day) ?? groups.set(day, []).get(day)!).push(m);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 sm:px-6 pb-20">
      <header className="pt-8 pb-5 border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2">
            <span className="text-accent">▸</span> {comp.name}
            {board?.season && (
              <span className="text-muted font-normal text-base">
                {board.season}
              </span>
            )}
          </h1>
          <Link
            href="/"
            className="text-[11px] uppercase tracking-wider text-muted hover:text-text"
          >
            World Cup →
          </Link>
        </div>
        <div className="mt-4">
          <CompetitionNav active={slug} />
        </div>
      </header>

      {matches.length === 0 ? (
        <div className="mt-10 rounded-xl border border-line bg-panel/50 p-8 text-center text-sm text-muted">
          No fixtures available right now — this competition may be between
          seasons. Live scores appear here when it&apos;s in season.
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[...groups.entries()].map(([day, ms]) => (
            <section key={day}>
              <div className="mb-2 flex items-center gap-3">
                <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
                  {new Date(day + "T12:00:00Z").toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </h2>
                <span className="flex-1 h-px bg-line" />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ms.map((m) => (
                  <LeagueCard key={m.id} slug={slug} m={m} rmap={rmap} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {projection && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              {projection.label}
            </h2>
            <AutoRefresh updatedAt={Date.now()} intervalMs={45_000} />
            <span className="flex-1 h-px bg-line" />
          </div>
          <LeagueProjection
            rows={projection.rows}
            showUcl={projection.showUcl}
            showUecl={projection.showUecl}
            showReleg={projection.showReleg}
            topLabel={projection.topLabel}
          />
        </section>
      )}

      {standings && standings.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
              {standings.length > 1 ? "Groups" : "Table"}
            </h2>
            <span className="flex-1 h-px bg-line" />
          </div>
          <Standings groups={standings} highlightTop={standings.length > 1 ? 2 : undefined} />
        </section>
      )}
    </div>
  );
}

async function buildProjection(
  slug: string,
  rows: import("@/lib/standings").StandingRow[],
  rmap: Map<string, number>
) {
  const n = rows.length;
  const full = 2 * (n - 1); // full single round-robin season length
  const maxGp = Math.max(...rows.map((r) => r.gp), 0);

  let ratings = rmap;
  let useCurrent = true;
  let label = "Season projection — our model";

  // ESPN season params are start-years; which year is "last season" depends
  // on where we are in the calendar (autumn: y-1, spring: y-2).
  const now = new Date();
  const priorYear =
    now.getUTCMonth() >= 6
      ? now.getUTCFullYear() - 1
      : now.getUTCFullYear() - 2;

  if (maxGp === 0) {
    // pre-season: rate from last season's final table
    ratings = await priorSeasonRatings(slug, priorYear);
    useCurrent = false;
    label = "Title race — projected season";
  } else if (maxGp >= full) {
    // last season complete: project the upcoming one from current strength
    useCurrent = false;
    label = "Title race — next season";
  } else {
    // mid-season: shrink noisy early-season form toward last season's level,
    // trusting the current table more as games accumulate
    const prior = await priorSeasonRatings(slug, priorYear);
    if (prior.size) {
      const blended = new Map<string, number>();
      for (const r of rows) {
        const cur = rmap.get(r.abbr);
        const prev = prior.get(r.abbr);
        if (cur != null && prev != null) {
          const w = r.gp / (r.gp + 10);
          blended.set(r.abbr, Math.round(w * cur + (1 - w) * prev));
        } else if (cur != null) blended.set(r.abbr, cur);
        else if (prev != null) blended.set(r.abbr, prev);
      }
      ratings = blended;
    }
  }

  if (ratings.size < 4) return null;
  const fixtures = await getRemainingFixtures(slug, useCurrent ? 6 : 12);
  if (fixtures.length < 1) return null;

  // Config-driven European spots (knows the Conference berth) where we have it;
  // otherwise fall back to ESPN's standings notes (e.g. Brazil — Libertadores).
  const struct = zoneCounts(slug) ?? qualStructure(rows);
  const proj = projectSeason(rows, ratings, fixtures, struct, 3000, useCurrent);
  if (!proj.length) return null;
  return {
    rows: proj,
    showUcl: struct.uclSpots > 0,
    showUecl: struct.ueclSpots > 0,
    showReleg: struct.relegSpots > 0,
    topLabel: struct.topLabel,
    label,
  };
}

const pct = (n: number) => `${Math.round(n * 100)}%`;

function LeagueCard({
  slug,
  m,
  rmap,
}: {
  slug: string;
  m: LeagueMatch;
  rmap: Map<string, number>;
}) {
  const live = m.status === "in";
  const done = m.status === "post";
  const showScore = live || done;

  // form-based forecast (W/D/W), in-play when live
  let probs: { pHome: number; pDraw: number; pAway: number } | null = null;
  const rh = rmap.get(m.home.abbr);
  const ra = rmap.get(m.away.abbr);
  if (rh && ra && !done) {
    const o = forecast(rh + 100, ra, MU_CLUB);
    if (live && m.minute != null && m.home.score != null && m.away.score != null) {
      probs = inPlay(
        o.lambdaHome,
        o.lambdaAway,
        Number(m.home.score),
        Number(m.away.score),
        Math.max(1, 90 - m.minute)
      );
    } else {
      probs = { pHome: o.pHome, pDraw: o.pDraw, pAway: o.pAway };
    }
  }

  return (
    <Link
      href={`/m/${slug}/${m.id}`}
      className={`block rounded-lg border bg-panel/80 card-shadow lift p-3 ${
        live ? "border-accent/60" : "border-line hover:border-zinc-500"
      }`}
    >
      <Row
        name={m.home.name}
        logo={m.home.logo}
        score={m.home.score}
        showScore={showScore}
        winner={!!m.home.winner}
      />
      <Row
        name={m.away.name}
        logo={m.away.logo}
        score={m.away.score}
        showScore={showScore}
        winner={!!m.away.winner}
      />

      {probs && (
        <div className="mt-2">
          <div className="mb-0.5 text-[8px] uppercase tracking-wider text-muted">
            {live ? `In-play · ${m.minute}'` : "Model"}
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-accent/80" style={{ width: pct(probs.pHome) }} />
            <div className="bg-zinc-600" style={{ width: pct(probs.pDraw) }} />
            <div className="bg-sky-400/70" style={{ width: pct(probs.pAway) }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[9px] text-muted tabnums">
            <span>{pct(probs.pHome)}</span>
            <span>D {pct(probs.pDraw)}</span>
            <span>{pct(probs.pAway)}</span>
          </div>
        </div>
      )}

      <div className="mt-1.5 text-[10px] uppercase tracking-wider text-muted flex items-center gap-1.5">
        {live && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
        <span className={live ? "text-accent" : ""}>{m.detail}</span>
      </div>
    </Link>
  );
}

function Row({
  name,
  logo,
  score,
  showScore,
  winner,
}: {
  name: string;
  logo?: string;
  score?: string;
  showScore: boolean;
  winner: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={logo} code={name} size={18} className="w-5" />
      <span className={`flex-1 truncate text-sm ${winner ? "font-semibold" : ""}`}>
        {name}
      </span>
      {showScore && (
        <span className="tabnums text-sm font-semibold w-5 text-right">
          {score}
        </span>
      )}
    </div>
  );
}
