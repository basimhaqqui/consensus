import { notFound } from "next/navigation";
import Link from "next/link";
import { fetchSummary, fetchPredictedSquads, type Goal } from "@/lib/match";
import { competitionBySlug } from "@/lib/leagues";
import { getStandings } from "@/lib/standings";
import { leagueRatings } from "@/lib/clubelo";
import { forecastClub } from "@/lib/model";
import Crest from "@/components/Crest";
import Lineups from "@/components/Lineups";
import { BallIcon } from "@/components/PlayerMarkers";
import TeamStats from "@/components/TeamStats";
import RecentMeetings from "@/components/RecentMeetings";
import CompetitionNav from "@/components/CompetitionNav";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default async function LeagueMatchPage({
  params,
}: {
  params: Promise<{ league: string; id: string }>;
}) {
  const { league, id } = await params;
  const [detail, standings] = await Promise.all([
    fetchSummary(league, id),
    getStandings(league),
  ]);
  if (!detail) notFound();

  // our model, generalised — ClubElo-backed where covered, form otherwise
  const rmap = await leagueRatings(league, standings);
  const rHome = rmap.get(detail.home.abbr);
  const rAway = rmap.get(detail.away.abbr);
  const outcome =
    rHome && rAway ? forecastClub(rHome, rAway) : null;

  const comp = competitionBySlug(league);
  const live = detail.status === "in";
  const decided = detail.status === "post";
  const showScore = live || decided;

  // Before the official lineups drop (~1h pre-kickoff), project each side's XI
  // from its last match — our prediction, clearly badged as such.
  let squads = detail.squads;
  let haveLineups = detail.hasLineups;
  if (!haveLineups && detail.status === "pre" && detail.home.id && detail.away.id) {
    const predicted = await fetchPredictedSquads(
      league,
      detail.home.id,
      detail.away.id
    );
    if (predicted) {
      squads = predicted;
      haveLineups = true;
    }
  }

  return (
    <main className="site-shell site-shell--match">
      <header className="site-topbar">
        <Link
          href={`/league/${league}`}
          className="back-link"
        >
          ← {comp?.name ?? "Scores"}
        </Link>
        <CompetitionNav active={league} />
      </header>

      {/* scoreline */}
      <div className="terminal-panel blueprint-surface mt-8 p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Side name={detail.home.name} logo={detail.home.logo} align="right" />
          <div className="text-center">
            {showScore ? (
              <div className="text-3xl font-bold tabnums">
                {detail.home.score}
                <span className="text-muted px-1">–</span>
                {detail.away.score}
              </div>
            ) : (
              <div className="text-sm text-muted">
                {detail.date
                  ? new Date(detail.date).toISOString().slice(0, 10)
                  : ""}
              </div>
            )}
            <div
              className={`mt-1 text-[11px] uppercase tracking-wider ${
                live ? "text-accent" : "text-muted"
              }`}
            >
              {live && "● "}
              {detail.detail}
            </div>
          </div>
          <Side name={detail.away.name} logo={detail.away.logo} align="left" />
        </div>

        {detail.goals.length > 0 && (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-4 text-[11px]">
            <div className="text-right space-y-0.5">
              {detail.goals
                .filter((g) => g.side === "home")
                .map((g, i) => (
                  <GoalLine key={i} g={g} />
                ))}
            </div>
            <div className="pt-0.5 mx-auto h-3.5 w-3.5">
              <BallIcon />
            </div>
            <div className="text-left space-y-0.5">
              {detail.goals
                .filter((g) => g.side === "away")
                .map((g, i) => (
                  <GoalLine key={i} g={g} />
                ))}
            </div>
          </div>
        )}

        {detail.venue && (
          <div className="mt-3 text-center text-[11px] text-muted">
            {detail.venue}
          </div>
        )}
      </div>

      {outcome && (
        <section className="terminal-panel mt-5 p-4">
          <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-3">
            Model forecast · form-based
          </h2>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-accent/80" style={{ width: pct(outcome.pHome) }} />
            <div className="bg-zinc-600" style={{ width: pct(outcome.pDraw) }} />
            <div className="bg-sky-400/70" style={{ width: pct(outcome.pAway) }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted tabnums">
            <span>
              {detail.home.name} {pct(outcome.pHome)}
            </span>
            <span>Draw {pct(outcome.pDraw)}</span>
            <span>
              {pct(outcome.pAway)} {detail.away.name}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-lg bg-panel2/60 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted">
                Expected goals
              </div>
              <div className="text-sm font-semibold tabnums">
                {outcome.lambdaHome.toFixed(1)} – {outcome.lambdaAway.toFixed(1)}
              </div>
            </div>
            <div className="rounded-lg bg-panel2/60 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted">
                Likely score
              </div>
              <div className="text-sm font-semibold tabnums">
                {outcome.topScore.home} – {outcome.topScore.away}
              </div>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-600">
            Ratings derived from this season&apos;s table (points &amp; goal
            difference per game). For entertainment.
          </p>
        </section>
      )}

      {detail.teamStats && (
        <TeamStats
          home={detail.teamStats.home}
          away={detail.teamStats.away}
          homeLogo={detail.home.logo}
          awayLogo={detail.away.logo}
        />
      )}

      <section className="mt-5">
        <div className="section-heading" data-index="03">
          <h2>Lineups</h2>
        </div>
        {haveLineups ? (
          <Lineups squads={squads} status={detail.status} />
        ) : (
          <div className="terminal-empty p-6 text-center text-sm">
            Lineups not announced yet — they typically drop about an hour
            before kickoff.
          </div>
        )}
      </section>

      <RecentMeetings games={detail.h2h} />
      <Footer />
    </main>
  );
}

function Side({
  name,
  logo,
  align,
}: {
  name: string;
  logo?: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Crest src={logo} code={name} size={44} />
      <div className="font-semibold leading-tight">{name}</div>
    </div>
  );
}

function GoalLine({ g }: { g: Goal }) {
  return (
    <div className="text-zinc-200">
      {g.scorer}{" "}
      <span className="text-muted tabnums">
        {g.minute}
        {g.tag ? ` (${g.tag})` : ""}
      </span>
    </div>
  );
}
