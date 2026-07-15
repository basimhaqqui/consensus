import Link from "next/link";
import {
  COMPETITIONS,
  getLeagueScoreboard,
  type Competition,
  type LeagueMatch,
} from "@/lib/leagues";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
import { consensusPA, getCards } from "@/lib/ufc/data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export default async function Landing() {
  // pull every competition's scoreboard in parallel; surface live + next games
  const boards = await Promise.all(
    COMPETITIONS.map((c) =>
      getLeagueScoreboard(c.slug).then((b) => ({ c, b }))
    )
  );

  const live: { c: Competition; m: LeagueMatch }[] = [];
  const counts = new Map<string, { live: number; total: number }>();
  for (const { c, b } of boards) {
    const ms = b?.matches ?? [];
    const liveMs = ms.filter((m) => m.status === "in");
    counts.set(c.slug, { live: liveMs.length, total: ms.length });
    liveMs.forEach((m) => live.push({ c, m }));
  }

  const nextMatches = boards
    .flatMap(({ c, b }) =>
      (b?.matches ?? [])
        .filter((m) => m.status === "pre")
        .map((m) => ({ c, m }))
    )
    .sort((a, b) => a.m.dateISO.localeCompare(b.m.dateISO));
  const footballSpotlight = live[0] ?? nextMatches[0];
  const nextUfc = getCards()[0];
  const mainEvent = nextUfc?.fights.at(-1);
  const mainEventConsensus = mainEvent ? consensusPA(mainEvent).p : null;

  return (
    <main className={styles.shell}>
      <div className={styles.ambient} aria-hidden="true" />

      <div className={styles.masthead}>
        <div className={styles.wordmark}>
          <span className={styles.prompt}>▸</span>
          <span>CONSENSUS</span>
          <span className={styles.wordmarkSuffix}>/ INTELLIGENCE DESK</span>
        </div>
        <div className={styles.systemStatus}>
          <span className={styles.statusDot} aria-hidden="true" />
          Data feed online
        </div>
      </div>

      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <div className={styles.eyebrow}>
            Sports intelligence, distilled
          </div>
          <h1 className={styles.heroTitle}>
            See the match
            <span>before it unfolds.</span>
          </h1>
        </div>

        <div className={styles.heroAside}>
          <p className={styles.heroDescription}>
            Live scores, model forecasts, market context, and public results for
            football and UFC—built to tell you what matters now.
          </p>
          <div className={styles.heroActions}>
            <Link href="/signals" className={styles.primaryAction}>
              See today&apos;s signals
              <span aria-hidden="true">↗</span>
            </Link>
            <div className={styles.deskActions}>
              <Link href="/wc" className={styles.secondaryAction}>
                Football desk
                <span aria-hidden="true">↗</span>
              </Link>
              <Link href="/ufc" className={`${styles.secondaryAction} ${styles.combatAction}`}>
                UFC desk
                <span aria-hidden="true">↗</span>
              </Link>
            </div>
            <span className={styles.actionMeta}>
              Live data · 49k model results · public ledgers
            </span>
          </div>
        </div>
      </header>

      <section className={styles.productPreview} aria-labelledby="today-heading">
        <div className={styles.previewHeading}>
          <div>
            <span className={styles.statusDot} aria-hidden="true" />
            <h2 id="today-heading">Today&apos;s intelligence</h2>
          </div>
          <span>Two sports · one clear read</span>
        </div>

        <div className={styles.previewGrid}>
          {footballSpotlight ? (
            <Link
              href={`/m/${footballSpotlight.c.slug}/${footballSpotlight.m.id}`}
              className={`${styles.previewCard} ${styles.footballPreview}`}
            >
              <div className={styles.previewTopline}>
                <span>Football desk</span>
                <span className={footballSpotlight.m.status === "in" ? styles.nowLabel : undefined}>
                  {footballSpotlight.m.status === "in" ? "Live now" : footballSpotlight.m.detail}
                </span>
              </div>
              <div className={styles.previewCompetition}>{footballSpotlight.c.name}</div>
              <div className={styles.previewMatchup}>
                <PreviewTeam
                  side={footballSpotlight.m.home}
                  showScore={footballSpotlight.m.status === "in"}
                />
                <span className={styles.previewVersus}>
                  {footballSpotlight.m.status === "in" ? "—" : "vs"}
                </span>
                <PreviewTeam
                  side={footballSpotlight.m.away}
                  align="right"
                  showScore={footballSpotlight.m.status === "in"}
                />
              </div>
              <div className={styles.previewFooter}>
                <span>Score · lineups · match intelligence</span>
                <strong>Open match center ↗</strong>
              </div>
            </Link>
          ) : (
            <Link href="/wc" className={`${styles.previewCard} ${styles.footballPreview}`}>
              <div className={styles.previewTopline}>
                <span>Football desk</span>
                <span>2026</span>
              </div>
              <div className={styles.emptyPreview}>
                <span>World Cup forecast center</span>
                <strong>Elo simulations, bracket paths, and a graded ledger.</strong>
              </div>
              <div className={styles.previewFooter}>
                <span>Forecast · bracket · ledger</span>
                <strong>Open football ↗</strong>
              </div>
            </Link>
          )}

          {nextUfc && mainEvent ? (
            <Link
              href={`/ufc/event/${nextUfc.eventId}`}
              className={`${styles.previewCard} ${styles.ufcPreview}`}
            >
              <div className={styles.previewTopline}>
                <span>UFC desk</span>
                <span>{formatShortDate(nextUfc.date)}</span>
              </div>
              <div className={styles.previewCompetition}>{nextUfc.name}</div>
              <div className={styles.fightMatchup}>
                <div>
                  <span>Consensus pick</span>
                  <strong>
                    {mainEventConsensus !== null && mainEventConsensus >= 0.5
                      ? mainEvent.a.name
                      : mainEvent.b.name}
                  </strong>
                </div>
                <div className={styles.fightProbability}>
                  <strong className="tabnums">
                    {mainEventConsensus === null
                      ? "—"
                      : `${Math.round(Math.max(mainEventConsensus, 1 - mainEventConsensus) * 100)}%`}
                  </strong>
                  <span>to win</span>
                </div>
              </div>
              <div className={styles.probabilityTrack} aria-hidden="true">
                <span style={{ width: `${(mainEventConsensus ?? 0.5) * 100}%` }} />
              </div>
              <div className={styles.previewFooter}>
                <span>{mainEvent.a.name} vs {mainEvent.b.name}</span>
                <strong>Open fight board ↗</strong>
              </div>
            </Link>
          ) : (
            <Link href="/ufc" className={`${styles.previewCard} ${styles.ufcPreview}`}>
              <div className={styles.previewTopline}>
                <span>UFC desk</span>
                <span>Model online</span>
              </div>
              <div className={styles.emptyPreview}>
                <span>Combat intelligence</span>
                <strong>Fight forecasts, fighter ratings, rankings, and public results.</strong>
              </div>
              <div className={styles.previewFooter}>
                <span>Fights · fighters · ledger</span>
                <strong>Open UFC ↗</strong>
              </div>
            </Link>
          )}
        </div>
      </section>

      <div className={styles.dataRail}>
        <div>
          <span>Coverage</span>
          <strong>{String(COMPETITIONS.length + 1).padStart(2, "0")} competitions</strong>
        </div>
        <div>
          <span>Live layer</span>
          <strong>Scores · fights · stats</strong>
        </div>
        <div>
          <span>Forecasting</span>
          <strong>Football Elo · UFC consensus</strong>
        </div>
      </div>

      {live.length > 0 && (
        <section className={styles.section}>
          <SectionHeading
            label="Live now"
            detail={`${String(live.length).padStart(2, "0")} active`}
            live
          />
          <div className={styles.liveGrid}>
            {live.slice(0, 6).map(({ c, m }) => (
              <LiveMatch key={m.id} comp={c} m={m} />
            ))}
          </div>
        </section>
      )}

      <section className={styles.section}>
        <SectionHeading
          label="Competition desk"
          detail={`${String(COMPETITIONS.length + 1).padStart(2, "0")} tracked`}
        />
        <div className={styles.competitionGrid}>
          {COMPETITIONS.map((c, index) => {
            const ct = counts.get(c.slug);
            const href = c.slug === "fifa.world" ? "/wc" : `/league/${c.slug}`;
            return (
              <Link key={c.slug} href={href} className={styles.competitionCard}>
                <div className={styles.competitionTopline}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <span>{c.short}</span>
                </div>
                <div className={styles.competitionName}>
                  <h3>{c.name}</h3>
                  {c.slug === "fifa.world" && (
                    <span className={styles.modelBadge}>Model</span>
                  )}
                </div>
                <div className={styles.competitionFooter}>
                  <span className={ct?.live ? styles.liveStatus : undefined}>
                    {ct?.live
                      ? `${ct.live} live now`
                      : ct?.total
                        ? `${ct.total} fixtures`
                        : "off-season"}
                  </span>
                  <span className={styles.cardArrow} aria-hidden="true">
                    ↗
                  </span>
                </div>
              </Link>
            );
          })}
          <Link
            href="/ufc"
            className={`${styles.competitionCard} ${styles.competitionCardCombat}`}
          >
            <div className={styles.competitionTopline}>
              <span>{String(COMPETITIONS.length + 1).padStart(2, "0")}</span>
              <span>UFC</span>
            </div>
            <div className={styles.competitionName}>
              <h3>Ultimate Fighting Championship</h3>
              <span className={styles.combatBadge}>Combat</span>
            </div>
            <div className={styles.competitionFooter}>
              <span>Fight desk · rankings · ledger</span>
              <span className={styles.cardArrow} aria-hidden="true">↗</span>
            </div>
          </Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}

function formatShortDate(dateISO: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(dateISO));
}

function PreviewTeam({
  side,
  align = "left",
  showScore = false,
}: {
  side: LeagueMatch["home"];
  align?: "left" | "right";
  showScore?: boolean;
}) {
  return (
    <div className={`${styles.previewTeam} ${align === "right" ? styles.previewTeamRight : ""}`}>
      <Crest src={side.logo} code={side.name} size={32} className={styles.previewCrest} />
      <div>
        <span>{side.abbr || side.name}</span>
        <strong>{side.name}</strong>
      </div>
      {showScore && side.score !== undefined && <b className="tabnums">{side.score}</b>}
    </div>
  );
}

function SectionHeading({
  label,
  detail,
  live = false,
}: {
  label: string;
  detail: string;
  live?: boolean;
}) {
  return (
    <div className={styles.sectionHeading}>
      <div>
        {live && <span className={styles.statusDot} aria-hidden="true" />}
        <h2>{label}</h2>
      </div>
      <span className={styles.sectionLine} />
      <span>{detail}</span>
    </div>
  );
}

function LiveMatch({ comp, m }: { comp: Competition; m: LeagueMatch }) {
  return (
    <Link href={`/m/${comp.slug}/${m.id}`} className={styles.liveCard}>
      <div className={styles.liveTopline}>
        <span>{comp.short}</span>
        <span className={styles.liveClock}>
          <span className={styles.statusDot} aria-hidden="true" />
          {m.detail}
        </span>
      </div>
      <div className={styles.teams}>
        <Row name={m.home.name} logo={m.home.logo} score={m.home.score} />
        <Row name={m.away.name} logo={m.away.logo} score={m.away.score} />
      </div>
      <span className={styles.liveArrow} aria-hidden="true">
        ↗
      </span>
    </Link>
  );
}

function Row({
  name,
  logo,
  score,
}: {
  name: string;
  logo?: string;
  score?: string;
}) {
  return (
    <div className={styles.teamRow}>
      <Crest src={logo} code={name} size={20} className={styles.crest} />
      <span>{name}</span>
      <strong className="tabnums">{score}</strong>
    </div>
  );
}
