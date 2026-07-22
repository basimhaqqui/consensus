import type { Metadata } from "next";
import Link from "next/link";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";
import {
  COMPETITIONS,
  getLeagueScoreboard,
  type Competition,
  type LeagueMatch,
} from "@/lib/leagues";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Football Intelligence Desk — CONSENSUS",
  description:
    "Live club football, independent match forecasts, season projections, market context, and the complete World Cup 2026 archive.",
  alternates: { canonical: "/football" },
  openGraph: {
    title: "Football Intelligence Desk — CONSENSUS",
    description:
      "The always-on football desk: live matches, model forecasts, season projections, and public results.",
    url: "/football",
    siteName: "CONSENSUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Football Intelligence Desk — CONSENSUS",
    description:
      "Live club football, independent forecasts, season projections, and a public record.",
  },
};

type Board = { competition: Competition; matches: LeagueMatch[]; season?: string };
type MatchItem = { competition: Competition; match: LeagueMatch };

const CLUB_COMPETITIONS = COMPETITIONS.filter(
  (competition) => competition.slug !== "fifa.world"
);

export default async function FootballDesk() {
  const boards: Board[] = await Promise.all(
    CLUB_COMPETITIONS.map(async (competition) => {
      const board = await getLeagueScoreboard(competition.slug);
      return {
        competition,
        matches: board?.matches ?? [],
        season: board?.season,
      };
    })
  );

  const slate = boards.flatMap(({ competition, matches }) =>
    matches.map((match) => ({ competition, match }))
  );
  const live = slate.filter(({ match }) => match.status === "in");
  const upcoming = slate
    .filter(({ match }) => match.status === "pre")
    .sort((a, b) => a.match.dateISO.localeCompare(b.match.dateISO));
  const completed = slate
    .filter(({ match }) => match.status === "post")
    .sort((a, b) => b.match.dateISO.localeCompare(a.match.dateISO));
  const featured = [...live, ...upcoming].slice(0, 6);
  const activeCompetitions = boards.filter(({ matches }) => matches.length > 0).length;

  return (
    <main className={`site-shell ${styles.shell}`}>
      <div className="site-topbar">
        <Link href="/" className="site-wordmark">
          <span>▸</span> CONSENSUS
        </Link>
        <Nav />
      </div>

      <header className={styles.hero}>
        <div>
          <div className="site-kicker">Football / always on</div>
          <h1 className={styles.title}>
            The club game,
            <span>through one clear lens.</span>
          </h1>
          <p className={styles.subtitle}>
            Live scores, independent forecasts, market context, and season
            projections across the competitions that matter—without waiting for
            the next tournament.
          </p>
        </div>

        <div className={styles.heroPanel}>
          <div className={styles.heroStatus}>
            <span className="signal-dot" aria-hidden="true" />
            <span>Football desk online</span>
          </div>
          <div className={styles.heroMetrics}>
            <DeskMetric value={String(CLUB_COMPETITIONS.length).padStart(2, "0")} label="competitions" />
            <DeskMetric value={String(live.length).padStart(2, "0")} label="live now" />
            <DeskMetric value="ClubElo" label="model layer" />
          </div>
          <Link href="/signals" className={styles.primaryAction}>
            Open today&apos;s signals <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <section className={styles.statusRail} aria-label="Football desk status">
        <div>
          <span>Current slate</span>
          <strong>{live.length ? `${live.length} live matches` : `${upcoming.length} upcoming matches`}</strong>
        </div>
        <div>
          <span>Active feeds</span>
          <strong>{activeCompetitions}/{CLUB_COMPETITIONS.length} competitions</strong>
        </div>
        <div>
          <span>Forecast method</span>
          <strong>Ratings → goals → outcome</strong>
        </div>
        <div>
          <span>Tournament history</span>
          <Link href="/wc">World Cup 2026 archive ↗</Link>
        </div>
      </section>

      <section className={styles.section}>
        <SectionHeading
          index="01"
          title={live.length ? "Live now" : "Next on the board"}
          detail={featured.length ? `${featured.length} matches` : "between slates"}
          live={live.length > 0}
        />
        {featured.length > 0 ? (
          <div className={styles.matchGrid}>
            {featured.map((item) => (
              <DeskMatch key={`${item.competition.slug}-${item.match.id}`} item={item} />
            ))}
          </div>
        ) : (
          <div className={styles.emptyState}>
            <span>Club calendars are resetting.</span>
            <p>
              Competition boards will populate as the next fixture windows open.
              The UFC desk and World Cup archive remain available in the meantime.
            </p>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <SectionHeading
          index="02"
          title="Competition desk"
          detail={`${CLUB_COMPETITIONS.length} tracked`}
        />
        <div className={styles.competitionGrid}>
          {boards.map((board, index) => (
            <CompetitionCard key={board.competition.slug} board={board} index={index + 1} />
          ))}
        </div>
      </section>

      <section className={styles.archive}>
        <div>
          <span className={styles.archiveLabel}>Closed tournament / permanent record</span>
          <h2>World Cup 2026 archive</h2>
          <p>
            Revisit every knockout forecast, the completed bracket, final standings,
            best performers, and the model&apos;s graded record.
          </p>
        </div>
        <div className={styles.archiveActions}>
          <Link href="/wc">Open archive ↗</Link>
          <Link href="/bracket">Final bracket ↗</Link>
        </div>
      </section>

      {completed.length > 0 && (
        <section className={styles.section}>
          <SectionHeading index="03" title="Latest results" detail={`${Math.min(6, completed.length)} shown`} />
          <div className={styles.resultStrip}>
            {completed.slice(0, 6).map((item) => (
              <DeskMatch key={`result-${item.competition.slug}-${item.match.id}`} item={item} compact />
            ))}
          </div>
        </section>
      )}

      <Footer />
    </main>
  );
}

function DeskMetric({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <strong className="tabnums">{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  detail,
  live = false,
}: {
  index: string;
  title: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        <span>{index}</span>
        {live && <i className="signal-dot" aria-hidden="true" />}
        <h2>{title}</h2>
      </div>
      <span className={styles.headingLine} />
      <span>{detail}</span>
    </div>
  );
}

function DeskMatch({ item, compact = false }: { item: MatchItem; compact?: boolean }) {
  const { competition, match } = item;
  const showScore = match.status !== "pre";
  const live = match.status === "in";
  return (
    <Link
      href={`/m/${competition.slug}/${match.id}`}
      className={`${styles.matchCard} ${compact ? styles.matchCardCompact : ""} ${live ? styles.matchCardLive : ""}`}
    >
      <div className={styles.matchTopline}>
        <span>{competition.short}</span>
        <span className={live ? styles.liveText : undefined}>{live ? "LIVE" : match.detail}</span>
      </div>
      <TeamRow side={match.home} showScore={showScore} />
      <TeamRow side={match.away} showScore={showScore} />
      <div className={styles.matchFooter}>
        <span>{live ? `${match.minute ?? "—"}' · in-play forecast` : showScore ? "Final · match report" : formatKickoff(match.dateISO)}</span>
        <span aria-hidden="true">↗</span>
      </div>
    </Link>
  );
}

function TeamRow({ side, showScore }: { side: LeagueMatch["home"]; showScore: boolean }) {
  return (
    <div className={styles.teamRow}>
      <Crest src={side.logo} code={side.abbr || side.name} size={24} />
      <span className={side.winner ? styles.winner : undefined}>{side.name}</span>
      {showScore && <strong className="tabnums">{side.score ?? "—"}</strong>}
    </div>
  );
}

function CompetitionCard({ board, index }: { board: Board; index: number }) {
  const live = board.matches.filter((match) => match.status === "in").length;
  const upcoming = board.matches.filter((match) => match.status === "pre").length;
  return (
    <Link href={`/league/${board.competition.slug}`} className={styles.competitionCard}>
      <div className={styles.competitionTopline}>
        <span>{String(index).padStart(2, "0")}</span>
        <span>{board.competition.short}</span>
      </div>
      <h3>{board.competition.name}</h3>
      <div className={styles.competitionMeta}>
        <span>{board.season ?? "Current season"}</span>
        <span className={live ? styles.liveText : undefined}>
          {live ? `${live} live` : upcoming ? `${upcoming} upcoming` : "between slates"}
        </span>
      </div>
    </Link>
  );
}

function formatKickoff(dateISO: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
  }).format(new Date(dateISO));
}
