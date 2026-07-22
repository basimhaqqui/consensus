import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
import MatchShareButton from "@/components/MatchShareButton";
import Nav from "@/components/Nav";
import FighterFace from "@/components/ufc/FighterFace";
import {
  getShareSignal,
  type ShareSignalSide,
  type ShareSignalSport,
} from "@/lib/shareSignals";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ sport: string; id: string }>;
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sport, id } = await params;
  const signal = await getShareSignal(sport, id);
  if (!signal) return { title: "Signal unavailable — CONSENSUS" };

  const title = `${signal.pickName} ${pct(signal.probability)} — CONSENSUS Signal`;
  const description = `${signal.pickName} is the ${signal.methodLabel.toLowerCase()} call against ${signal.opponentName}. ${signal.reason}`;

  return {
    title,
    description,
    alternates: { canonical: signal.sharePath },
    openGraph: {
      title,
      description,
      type: "article",
      url: signal.sharePath,
      siteName: "CONSENSUS",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function SignalPage({ params }: Props) {
  const { sport, id } = await params;
  const signal = await getShareSignal(sport, id);
  if (!signal) notFound();

  const pick = signal.pickSide === "left" ? signal.left : signal.right;
  const shareUrl = `${signal.sharePath}?utm_source=shared_signal&utm_medium=social_card`;
  const marketGap = signal.marketProbability === undefined
    ? undefined
    : signal.modelProbability - signal.marketProbability;

  return (
    <main className={`site-shell site-shell--match ${styles.shell}`}>
      <header className="site-topbar">
        <Link href="/signals" className="back-link">
          ← Daily signals
        </Link>
        <Nav />
      </header>

      <section className={`${styles.hero} ${signal.sport === "ufc" ? styles.heroUfc : ""}`}>
        <div className={styles.heroTopline}>
          <span>Shared signal · {signal.desk}</span>
          <span>{signal.date} · {signal.meta}</span>
        </div>

        <div className={styles.matchup}>
          <Identity side={signal.left} sport={signal.sport} />
          <span className={styles.versus}>vs</span>
          <Identity side={signal.right} sport={signal.sport} right />
        </div>

        <div className={styles.consensusCall}>
          <div>
            <span>{signal.methodLabel} call</span>
            <h1>{signal.pickName}</h1>
            <p>{signal.event}</p>
          </div>
          <div className={styles.probability}>
            <strong className="tabnums">{pct(signal.probability)}</strong>
            <span>{signal.outcomeLabel}</span>
          </div>
        </div>

        <div className={styles.track} aria-hidden="true">
          <span style={{ width: pct(signal.probability) }} />
        </div>

        <div className={styles.heroFooter}>
          <p><span>01</span>{signal.reason}</p>
          <MatchShareButton
            title={`${signal.pickName} ${pct(signal.probability)} — CONSENSUS`}
            text={signal.caption}
            url={shareUrl}
            label="Share this signal ↗"
            copyText
            analytics={{
              sport: signal.sport,
              signalId: signal.id,
              pick: signal.pickName,
              probability: Math.round(signal.probability * 100),
              surface: "signal_landing",
            }}
          />
        </div>
      </section>

      <div className={styles.contentGrid}>
        <section className={`terminal-panel ${styles.comparison}`}>
          <div className={styles.panelHeading}>
            <h2>Model / market read</h2>
            <span>{marketGap === undefined ? "model only" : `${Math.abs(Math.round(marketGap * 100))}pt gap`}</span>
          </div>
          <CompareRow label="Independent model" value={signal.modelProbability} tone="model" />
          {signal.marketProbability === undefined ? (
            <div className={styles.noLine}>Sportsbook price not available yet.</div>
          ) : (
            <CompareRow label="Sportsbooks" value={signal.marketProbability} tone="market" />
          )}
          <p className={styles.disclaimer}>
            Probabilities describe uncertainty, not certainty. For entertainment, not betting advice.
          </p>
        </section>

        <section className={`terminal-panel ${styles.captionPanel}`}>
          <div className={styles.panelHeading}>
            <h2>Ready-made caption</h2>
            <span>share copy</span>
          </div>
          <blockquote>{signal.caption}</blockquote>
          <div className={styles.captionActions}>
            <Link href={signal.destination}>{signal.actionLabel} ↗</Link>
            <MatchShareButton
              title={`${signal.pickName} ${pct(signal.probability)} — CONSENSUS`}
              text={signal.caption}
              url={shareUrl}
              label="Copy or share ↗"
              copyText
              analytics={{
                sport: signal.sport,
                signalId: signal.id,
                pick: signal.pickName,
                probability: Math.round(signal.probability * 100),
                surface: "caption_panel",
              }}
            />
          </div>
        </section>
      </div>

      <section className={styles.nextStep}>
        <span>Want the full evidence?</span>
        <p>Open the deeper briefing for matchup data, expected outcome, market context, and transparent model reasoning.</p>
        <Link href={signal.destination}>{signal.actionLabel} ↗</Link>
      </section>

      <Footer />
    </main>
  );
}

function Identity({
  side,
  sport,
  right = false,
}: {
  side: ShareSignalSide;
  sport: ShareSignalSport;
  right?: boolean;
}) {
  return (
    <div className={`${styles.identity} ${right ? styles.identityRight : ""}`}>
      {sport === "football" ? (
        <Crest teamKey={side.teamKey} code={side.code} src={side.logo} size={48} />
      ) : (
        <FighterFace
          id={side.fighter?.id ?? null}
          name={side.fighter?.name ?? side.name}
          size={58}
          tone={right ? "blue" : "red"}
        />
      )}
      <div>
        <span>{side.code}</span>
        <strong>{side.name}</strong>
      </div>
    </div>
  );
}

function CompareRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "model" | "market";
}) {
  return (
    <div className={styles.compareRow}>
      <div>
        <span>{label}</span>
        <strong className="tabnums">{pct(value)}</strong>
      </div>
      <div className={styles.compareTrack}>
        <span className={tone === "market" ? styles.marketBar : undefined} style={{ width: pct(value) }} />
      </div>
    </div>
  );
}
