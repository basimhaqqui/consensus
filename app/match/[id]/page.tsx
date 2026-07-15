import { notFound } from "next/navigation";
import Link from "next/link";
import { getLiveMatches } from "@/lib/live";
import { fetchMatchDetail, fetchPredictedSquads, type Goal } from "@/lib/match";
import MatchTimeline from "@/components/MatchTimeline";
import Lineups from "@/components/Lineups";
import { BallIcon } from "@/components/PlayerMarkers";
import TeamStats from "@/components/TeamStats";
import RecentMeetings from "@/components/RecentMeetings";
import NewsPanel from "@/components/NewsPanel";
import MarketBoard from "@/components/MarketBoard";
import { fetchNews, newsFor } from "@/lib/news";
import { briefFor } from "@/lib/briefs";
import { matchProps } from "@/lib/props";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import MatchBriefing from "@/components/MatchBriefing";
import BestPerformers from "@/components/BestPerformers";
import { getCompetitionPerformance } from "@/lib/competition";

export const dynamic = "force-dynamic";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

// Social/link previews: title carries the scoreline once decided, description
// carries the consensus advance odds. The card image is opengraph-image.tsx.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matches } = await getLiveMatches();
  const m = matches.find((x) => x.id === id);
  if (!m) return { title: "Match — CONSENSUS" };
  const score =
    m.score && m.status !== "scheduled"
      ? `${m.home.code} ${m.score.home}–${m.score.away} ${m.away.code}`
      : `${m.home.name} vs ${m.away.name}`;
  return {
    title: `${score} — CONSENSUS`,
    description: `Consensus to advance: ${m.home.name} ${pct(
      m.advance.home
    )} · ${m.away.name} ${pct(m.advance.away)} — live odds, lineups and our calibrated model.`,
  };
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matches } = await getLiveMatches();
  const m = matches.find((x) => x.id === id);
  if (!m) notFound();
  const performance = getCompetitionPerformance();

  const brief = m.status === "scheduled" ? briefFor(m.homeKey, m.awayKey) : undefined;
  const [detail, allNews, propsByMatch] = await Promise.all([
    fetchMatchDetail(id, m.espnId),
    fetchNews(),
    matchProps([m]),
  ]);
  const news = newsFor(allNews, [m.home.name, m.away.name]);

  // Before official lineups drop (~1h pre-kickoff), project each XI from the
  // team's last match — our prediction, badged as such.
  let squads = detail?.squads ?? [];
  let haveLineups = !!detail?.hasLineups;
  if (
    detail &&
    !haveLineups &&
    detail.status === "pre" &&
    detail.home.id &&
    detail.away.id
  ) {
    const predicted = await fetchPredictedSquads(
      "fifa.world",
      detail.home.id,
      detail.away.id
    );
    if (predicted) {
      squads = predicted;
      haveLineups = true;
    }
  }

  const live = detail?.status === "in";
  const decided = detail?.status === "post" || m.status === "final";


  return (
    <main className="site-shell site-shell--match">
      <header className="site-topbar">
        <Link
          href="/wc"
          className="back-link"
        >
          ← Terminal
        </Link>
        <Nav />
      </header>

      <MatchBriefing match={m} detail={detail} brief={brief} />

      {detail?.goals && detail.goals.length > 0 && (
        <section className="terminal-panel mt-5 p-4">
          <h2 className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            Scorers
          </h2>
          <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-x-5 text-[11px] sm:gap-x-7">
            <div className="space-y-1 text-right">
              {detail.goals.filter((goal) => goal.side === "home").map((goal, index) => (
                <GoalLine key={index} g={goal} />
              ))}
            </div>
            <div className="mx-auto h-3.5 w-3.5 min-w-[92px] pt-0.5 text-center [&>*]:mx-auto">
              <span className="block h-3.5 w-3.5">
                <BallIcon muted />
              </span>
            </div>
            <div className="space-y-1 text-left">
              {detail.goals.filter((goal) => goal.side === "away").map((goal, index) => (
                <GoalLine key={index} g={goal} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* events timeline */}
      {detail && detail.events.length > 0 && (live || decided) && (
        <section className="terminal-panel mt-5 p-4">
          <h2 className="mb-3 text-[10px] uppercase tracking-[0.2em] text-zinc-400">
            Timeline
          </h2>
          <MatchTimeline events={detail.events} />
        </section>
      )}

      {/* market fair prices — pre-match only */}
      {m.status === "scheduled" && (
        <div id="markets" className="scroll-mt-6">
          <MarketBoard
            lambdaHome={m.outcome.lambdaHome}
            lambdaAway={m.outcome.lambdaAway}
            homeCode={m.home.code}
            awayCode={m.away.code}
            players={propsByMatch[m.id] ?? []}
          />
        </div>
      )}

      {/* team match stats */}
      {detail?.teamStats && (
        <TeamStats
          home={detail.teamStats.home}
          away={detail.teamStats.away}
          homeKey={m.homeKey}
          awayKey={m.awayKey}
        />
      )}

      <section id="performers" className="mt-5 scroll-mt-6">
        <div className="section-heading" data-index="04">
          <h2>Best performers</h2>
        </div>
        <BestPerformers view={performance} />
      </section>

      {/* lineups */}
      <section id="lineups" className="mt-5 scroll-mt-6">
        <div className="section-heading" data-index="05">
          <h2>Lineups</h2>
        </div>
        {haveLineups ? (
          <Lineups squads={squads} status={detail?.status} />
        ) : (
          <div className="terminal-empty p-6 text-center text-sm">
            Lineups not announced yet — they typically post about an hour before
            kickoff. Check back closer to the match.
          </div>
        )}
      </section>

      {/* head to head */}
      {detail && (
        <div id="history" className="scroll-mt-6">
          <RecentMeetings games={detail.h2h} />
        </div>
      )}

      <div id="news" className="scroll-mt-6">
        <NewsPanel items={news} title="In the news" limit={3} index="06" />
      </div>
      <Footer />
    </main>
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
