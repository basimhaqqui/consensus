import Link from "next/link";
import {
  COMPETITIONS,
  getLeagueScoreboard,
  type Competition,
  type LeagueMatch,
} from "@/lib/leagues";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
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
            Football and combat intelligence in one terminal — live scores,
            match and fighter pages, forecasts, rankings, and auditable ledgers.
          </p>
          <div className={styles.heroActions}>
            <Link href="/wc" className={styles.primaryAction}>
              Enter terminal
              <span aria-hidden="true">↗</span>
            </Link>
            <span className={styles.actionMeta}>Live · ESPN data · 49k results</span>
          </div>
        </div>
      </header>

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

      <section className={styles.ufcFeature}>
        <div className={styles.ufcGlow} aria-hidden="true" />
        <div className={styles.ufcCopy}>
          <div className={styles.featureLabel}>
            <span>Integrated desk</span>
            <span className={styles.featureRule} />
            <span>02 / combat</span>
          </div>
          <h2>UFC Consensus</h2>
          <p>
            The full combat terminal: upcoming fight boards, dedicated fighter
            pages, official rankings, and a public ledger that grades every
            frozen forecast against the result and the market.
          </p>
          <div className={styles.signalTags}>
            <span>Fight board</span>
            <span>Fighter pages</span>
            <span>Graded ledger</span>
            <span>Rankings</span>
          </div>
        </div>

        <div className={styles.ufcSignal} aria-hidden="true">
          <div className={styles.signalHeader}>
            <span>Product surface</span>
            <span>Integrated</span>
          </div>
          <div className={styles.signalStack}>
            <span>FIGHTS</span>
            <span>FIGHTERS</span>
            <span>LEDGER</span>
          </div>
          <div className={styles.consensusRead}>
            <span>CONSENSUS READ</span>
            <span>READY</span>
          </div>
        </div>

        <Link href="/ufc" className={styles.ufcAction}>
          <span>Open UFC desk</span>
          <span aria-hidden="true">↗</span>
        </Link>
      </section>

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
