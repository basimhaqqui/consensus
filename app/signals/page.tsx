import type { Metadata } from "next";
import Link from "next/link";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
import MatchShareButton from "@/components/MatchShareButton";
import Nav from "@/components/Nav";
import { getClubSignalFeed, type ClubSignal } from "@/lib/clubSignals";
import FighterFace from "@/components/ufc/FighterFace";
import type { MatchView } from "@/lib/compute";
import { ledgerSummary } from "@/lib/ledger";
import { getBoards } from "@/lib/live";
import {
  consensusPA,
  getBookLine,
  getCards,
  type FighterRef,
  type FightForecast,
} from "@/lib/ufc/data";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Daily Signals — CONSENSUS",
  description:
    "The three clearest football and UFC calls right now, ranked with consensus probability, market context, and transparent reasoning.",
  alternates: { canonical: "/signals" },
  openGraph: {
    title: "Three signals. Zero noise. — CONSENSUS",
    description:
      "The clearest football and UFC calls right now, ranked by confidence, matchup importance, and live market context.",
    type: "website",
    url: "/signals",
    siteName: "CONSENSUS",
  },
  twitter: {
    card: "summary_large_image",
    title: "Three signals. Zero noise. — CONSENSUS",
    description:
      "The clearest football and UFC calls right now, ranked by confidence, matchup importance, and live market context.",
  },
};

type SignalSport = "football" | "ufc";

type SignalSide = {
  name: string;
  code: string;
  logo?: string;
  teamKey?: string;
  fighter?: FighterRef;
};

type Signal = {
  id: string;
  shareId: string;
  shareHref: string;
  sport: SignalSport;
  href: string;
  desk: string;
  event: string;
  date: string;
  meta: string;
  left: SignalSide;
  right: SignalSide;
  pickSide: "left" | "right";
  outcomeLabel: "to win" | "to advance";
  methodLabel: "Consensus" | "Independent model";
  leftProbability: number;
  rightProbability: number;
  drawProbability?: number;
  probability: number;
  modelProbability: number;
  marketProbability?: number;
  priority: number;
  reasons: [string, string];
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const points = (n: number) => `${Math.abs(Math.round(n * 100))}pt`;

export default async function SignalsPage() {
  const [boards, clubFeed] = await Promise.all([
    getBoards(),
    getClubSignalFeed(),
  ]);
  const cards = getCards();
  const nextCard =
    cards.find((card) => Date.parse(card.date) >= Date.now() - 12 * 3600e3) ??
    cards[0];
  const footballSignals = [
    ...clubFeed.signals.map(buildClubFootballSignal),
    ...buildFootballSignals(boards.blend.matches, boards.model.matches),
  ];
  const ufcSignals = nextCard
    ? nextCard.fights.map((fight) => buildUfcSignal(fight, nextCard.eventId, nextCard.name))
    : [];
  const signals = selectDiverseSignals(footballSignals, ufcSignals);
  const marketGap = [...footballSignals, ...ufcSignals]
    .filter(
      (signal): signal is Signal & { marketProbability: number } =>
        signal.marketProbability !== undefined
    )
    .sort(
      (a, b) =>
        Math.abs(b.modelProbability - b.marketProbability) -
        Math.abs(a.modelProbability - a.marketProbability)
    )[0];
  const ledger = ledgerSummary();
  const hitRate = ledger.blend.n
    ? Math.round((ledger.blend.hits / ledger.blend.n) * 100)
    : null;
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date());

  return (
    <main className={`site-shell ${styles.shell}`}>
      <header className="site-topbar">
        <Link href="/" className="site-wordmark">
          <span>▸</span> CONSENSUS
        </Link>
        <Nav />
      </header>

      <section className={styles.hero}>
        <div>
          <div className="site-kicker">Daily decision desk</div>
          <h1 className={styles.title}>
            Three signals.
            <span>Zero noise.</span>
          </h1>
          <p className={styles.subtitle}>
            The clearest calls across football and UFC, ranked by confidence,
            matchup importance, and live market pricing.
          </p>
        </div>
        <div className={styles.heroStatus}>
          <div>
            <span className="signal-dot" aria-hidden="true" />
            <strong>Signal desk online</strong>
          </div>
          <span>{dateLabel}</span>
          <small>Re-ranked whenever forecasts, markets, or the live slate move.</small>
        </div>
      </section>

      <div className={styles.summaryRail}>
        <SummaryStat
          label="Calls ranked"
          value={String(footballSignals.length + ufcSignals.length).padStart(2, "0")}
          sub="football + UFC"
        />
        <SummaryStat
          label="Strongest read"
          value={signals[0] ? pct(signals[0].probability) : "—"}
          sub={signals[0]?.pickSide === "left" ? signals[0].left.name : signals[0]?.right.name ?? "awaiting board"}
        />
        <SummaryStat
          label="WC graded record"
          value={hitRate === null ? "—" : `${hitRate}%`}
          sub={`${ledger.blend.hits}/${ledger.blend.n} football calls`}
        />
        <SummaryStat
          label="Football model"
          value="49k+"
          sub="results in the Elo base"
        />
      </div>

      {signals.length > 0 ? (
        <>
          <section className={styles.section}>
            <SectionHeading index="01" title="Top signal" detail="relevance × confidence" />
            <div className={styles.leadGrid}>
              <SignalCard signal={signals[0]} rank={1} featured />
              <aside className={styles.insightStack} aria-label="Signal desk context">
                <MarketGap signal={marketGap} />
                <div className={styles.contextGrid}>
                  <ContextCard
                    label="Method"
                    value={clubFeed.marketSignals > 0 ? "Market-linked" : marketGap ? "Mixed sources" : "Independent"}
                    sub={clubFeed.marketSignals > 0
                      ? `${clubFeed.marketSignals} club lines · model + books`
                      : marketGap
                        ? "model + market where posted"
                        : "model first · lines pending"}
                  />
                  <ContextCard
                    label="Refresh"
                    value={clubFeed.feedsOnline > 0 || boards.live ? "Live" : "Fallback"}
                    sub={`${clubFeed.feedsOnline}/${clubFeed.competitionsChecked} club feeds online`}
                    live={clubFeed.feedsOnline > 0 || boards.live}
                  />
                </div>
              </aside>
            </div>
          </section>

          {signals.length > 1 && (
            <section className={styles.section}>
              <SectionHeading
                index="02"
                title="Next on the board"
                detail={`${signals.length - 1} ranked ${signals.length - 1 === 1 ? "call" : "calls"}`}
              />
              <div className={styles.secondaryGrid}>
                {signals.slice(1).map((signal, index) => (
                  <SignalCard key={signal.id} signal={signal} rank={index + 2} />
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <section className={`${styles.section} terminal-empty ${styles.empty}`}>
          The next signal board will appear as soon as an upcoming matchup is confirmed.
        </section>
      )}

      <section className={styles.section}>
        <SectionHeading index="03" title="How to read the board" detail="probability, not certainty" />
        <div className={styles.explainer}>
          <ExplainerStep
            index="01"
            title="Start with the probability"
            text="The headline number is the blended chance of the picked side winning or advancing—not a promise."
          />
          <ExplainerStep
            index="02"
            title="Check the market gap"
            text="A large gap means our independent model and sportsbook prices see the matchup differently."
          />
          <ExplainerStep
            index="03"
            title="Open the full briefing"
            text="Every signal links to the deeper forecast, matchup data, and the assumptions behind the call."
          />
        </div>
      </section>

      <Footer />
    </main>
  );
}

function buildClubFootballSignal(club: ClubSignal): Signal {
  return {
    id: `football-${club.id}`,
    shareId: club.id,
    shareHref: `${club.sharePath}?utm_source=shared_signal&utm_medium=social_card`,
    sport: "football",
    href: club.destination,
    desk: club.status === "in"
      ? `${club.competitionShort} · live`
      : `${club.competitionShort} · club forecast`,
    event: club.competition,
    date: club.date,
    meta: club.meta,
    left: club.left,
    right: club.right,
    pickSide: club.pickSide,
    outcomeLabel: "to win",
    methodLabel: club.marketProbability === undefined
      ? "Independent model"
      : "Consensus",
    leftProbability: club.homeProbability,
    rightProbability: club.awayProbability,
    drawProbability: club.drawProbability,
    probability: club.probability,
    modelProbability: club.modelProbability,
    marketProbability: club.marketProbability,
    priority: club.priority,
    reasons: club.reasons,
  };
}

function buildFootballSignals(
  consensusMatches: MatchView[],
  modelMatches: MatchView[]
): Signal[] {
  const modelById = new Map(modelMatches.map((match) => [match.id, match]));

  return consensusMatches
    .filter((match) => match.status !== "final")
    .map((match) => {
      const advance = match.liveAdvance ?? match.advance;
      const pickLeft = advance.home >= advance.away;
      const pick = pickLeft ? match.home : match.away;
      const opponent = pickLeft ? match.away : match.home;
      const model = modelById.get(match.id) ?? match;
      const modelAdvance = model.liveAdvance ?? model.advance;
      const modelProbability = pickLeft ? modelAdvance.home : modelAdvance.away;
      const marketProbability = model.market
        ? pickLeft
          ? model.market.advHome
          : 1 - model.market.advHome
        : undefined;
      const goalEdge = pickLeft
        ? match.outcome.lambdaHome - match.outcome.lambdaAway
        : match.outcome.lambdaAway - match.outcome.lambdaHome;
      const margin = Math.abs(advance.home - advance.away);
      const marketReason = marketProbability === undefined
        ? "No sportsbook comparison is available yet, so this call currently leans on the independent tournament model."
        : `Books price ${pick.name} at ${pct(marketProbability)}; consensus settles at ${pct(
            pickLeft ? advance.home : advance.away
          )}.`;

      return {
        id: `football-${match.id}`,
        shareId: match.id,
        shareHref: `/signal/football/${match.id}?utm_source=shared_signal&utm_medium=social_card`,
        sport: "football" as const,
        href: `/match/${match.id}`,
        desk: match.status === "live" ? "Football · live" : "Football · World Cup",
        event: roundLabel(match.id),
        date: match.status === "live" ? match.live?.detail ?? "Live" : match.date,
        meta: match.venue,
        left: {
          name: match.home.name,
          code: match.home.code,
          teamKey: match.homeKey,
        },
        right: {
          name: match.away.name,
          code: match.away.code,
          teamKey: match.awayKey,
        },
        pickSide: pickLeft ? "left" as const : "right" as const,
        outcomeLabel: "to advance" as const,
        methodLabel: "Consensus" as const,
        leftProbability: advance.home,
        rightProbability: advance.away,
        probability: pickLeft ? advance.home : advance.away,
        modelProbability,
        marketProbability,
        priority:
          (pickLeft ? advance.home : advance.away) * 0.68 +
          footballImportance(match.id, match.status === "live") * 0.32,
        reasons: [
          `${pick.name} owns a ${points(margin)} advantage over ${opponent.name} in the to-advance forecast.`,
          goalEdge >= 0.15
            ? `The scoring model projects a ${goalEdge.toFixed(1)} expected-goal edge before extra time or penalties.`
            : marketReason,
        ] as [string, string],
      };
    })
    .sort((a, b) => b.probability - a.probability);
}

function buildUfcSignal(
  fight: FightForecast,
  eventId: string,
  eventName: string
): Signal {
  const consensus = consensusPA(fight);
  const pickLeft = consensus.p >= 0.5;
  const pick = pickLeft ? fight.a : fight.b;
  const opponent = pickLeft ? fight.b : fight.a;
  const book = getBookLine(fight.boutId);
  const modelProbability = pickLeft ? fight.pA : 1 - fight.pA;
  const marketProbability = book
    ? pickLeft
      ? book.pA
      : 1 - book.pA
    : undefined;
  const probability = pickLeft ? consensus.p : 1 - consensus.p;
  const ratingEdge = Math.abs(fight.ratingA - fight.ratingB);

  return {
    id: `ufc-${fight.boutId}`,
    shareId: fight.boutId,
    shareHref: `/signal/ufc/${fight.boutId}?utm_source=shared_signal&utm_medium=social_card`,
    sport: "ufc",
    href: `/ufc/event/${eventId}#bout-${fight.boutId}`,
    desk: "UFC · fight forecast",
    event: eventName,
    date: formatDate(fight.date),
    meta: fight.weightClass ?? "Scheduled bout",
    left: {
      name: fight.a.name ?? "TBD",
      code: lastName(fight.a.name),
      fighter: fight.a,
    },
    right: {
      name: fight.b.name ?? "TBD",
      code: lastName(fight.b.name),
      fighter: fight.b,
    },
    pickSide: pickLeft ? "left" : "right",
    outcomeLabel: "to win",
    methodLabel: "Consensus",
    leftProbability: consensus.p,
    rightProbability: 1 - consensus.p,
    probability,
    modelProbability,
    marketProbability,
    priority: probability * 0.68 + ufcImportance(fight) * 0.32,
    reasons: [
      `${pick.name ?? "The pick"} carries the stronger blended win probability against ${opponent.name ?? "the opponent"}.`,
      marketProbability === undefined
        ? `The model sees a ${ratingEdge}-point rating gap; no sportsbook line has posted yet.`
        : `Independent model ${pct(modelProbability)} · books ${pct(marketProbability)} · consensus ${pct(probability)}.`,
    ],
  };
}

function selectDiverseSignals(football: Signal[], ufc: Signal[]): Signal[] {
  const rank = (a: Signal, b: Signal) =>
    b.priority - a.priority || b.probability - a.probability;
  const footballRanked = [...football].sort(rank);
  const ufcRanked = [...ufc].sort(rank);
  const all = [...footballRanked, ...ufcRanked].sort(rank);
  if (football.length === 0 || ufc.length === 0) return all.slice(0, 3);

  const first = all[0];
  const opposite = (first.sport === "football" ? ufcRanked : footballRanked)[0];
  const selected = [first, opposite];
  const third = all.find((signal) => !selected.some((pick) => pick.id === signal.id));
  if (third) selected.push(third);
  return selected.sort(rank);
}

function footballImportance(id: string, live: boolean) {
  const stage = id === "final"
    ? 1.12
    : id.startsWith("sf-")
      ? 1.04
      : id.startsWith("qf-")
        ? 0.9
        : 0.72;
  return stage + (live ? 0.08 : 0);
}

function ufcImportance(fight: FightForecast) {
  if (fight.matchNumber === 1) return 1;
  if (fight.segment === "Main Card") return 0.72;
  return 0.34;
}

function SignalCard({
  signal,
  rank,
  featured = false,
}: {
  signal: Signal;
  rank: number;
  featured?: boolean;
}) {
  const pick = signal.pickSide === "left" ? signal.left : signal.right;
  const shareTitle = `${pick.name} ${pct(signal.probability)} — CONSENSUS`;
  const shareText = `${pick.name} is the ${signal.methodLabel.toLowerCase()} call at ${pct(signal.probability)} ${signal.outcomeLabel} in ${signal.left.name} vs ${signal.right.name}.`;

  return (
    <article
      className={`${styles.signalCard} ${featured ? styles.signalCardFeatured : ""} ${
        signal.sport === "ufc" ? styles.signalCardUfc : ""
      }`}
    >
      <div className={styles.cardTopline}>
        <span>Signal {String(rank).padStart(2, "0")}</span>
        <span>{signal.desk}</span>
      </div>

      <div className={styles.cardMeta}>
        <strong>{signal.event}</strong>
        <span>{signal.date} · {signal.meta}</span>
      </div>

      <div className={styles.matchup}>
        <SignalIdentity side={signal.left} sport={signal.sport} />
        <span className={styles.versus}>vs</span>
        <SignalIdentity side={signal.right} sport={signal.sport} right />
      </div>

      <div className={styles.callout}>
        <div>
          <span>
            {signal.probability < 0.56
              ? `${signal.methodLabel} lean`
              : `${signal.methodLabel} call`}
          </span>
          <strong>{pick.name}</strong>
        </div>
        <div className={styles.callProbability}>
          <strong className="tabnums">{pct(signal.probability)}</strong>
          <span>
            {signal.probability < 0.56
              ? "close call"
              : signal.outcomeLabel}
          </span>
        </div>
      </div>

      <div
        className={styles.probabilityTrack}
        role="img"
        aria-label={signal.drawProbability === undefined
          ? `${signal.left.name} ${pct(signal.leftProbability)}, ${signal.right.name} ${pct(signal.rightProbability)}`
          : `${signal.left.name} ${pct(signal.leftProbability)}, draw ${pct(signal.drawProbability)}, ${signal.right.name} ${pct(signal.rightProbability)}`}
      >
        <span
          style={{
            width: pct(signal.leftProbability),
          }}
        />
        {signal.drawProbability !== undefined ? (
          <span
            className={styles.drawProbability}
            style={{ width: pct(signal.drawProbability) }}
          />
        ) : null}
      </div>
      <div className={styles.probabilityLabels}>
        <span>{signal.left.code}</span>
        {signal.drawProbability !== undefined ? (
          <span>D {pct(signal.drawProbability)}</span>
        ) : null}
        <span>{signal.right.code}</span>
      </div>

      <div className={styles.reasoning}>
        <span>Why this call</span>
        <ol>
          {signal.reasons.map((reason, index) => (
            <li key={reason}>
              <span>0{index + 1}</span>
              <p>{reason}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.cardFooter}>
        <Link href={signal.href}>Open full briefing ↗</Link>
        <MatchShareButton
          title={shareTitle}
          text={shareText}
          url={signal.shareHref}
          label="Share signal ↗"
          copyText
          analytics={{
            sport: signal.sport,
            signalId: signal.shareId,
            pick: pick.name,
            probability: Math.round(signal.probability * 100),
            surface: "daily_signals",
          }}
        />
      </div>
    </article>
  );
}

function SignalIdentity({
  side,
  sport,
  right = false,
}: {
  side: SignalSide;
  sport: SignalSport;
  right?: boolean;
}) {
  return (
    <div className={`${styles.identity} ${right ? styles.identityRight : ""}`}>
      {sport === "football" ? (
        <Crest teamKey={side.teamKey} src={side.logo} code={side.code} size={40} />
      ) : (
        <FighterFace
          id={side.fighter?.id ?? null}
          name={side.fighter?.name ?? side.name}
          size={48}
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

function MarketGap({ signal }: { signal?: Signal & { marketProbability: number } }) {
  if (!signal) {
    return (
      <div className={`${styles.marketGap} terminal-panel`}>
        <span>Market watch</span>
        <strong>No active lines</strong>
        <p>The comparison will populate as soon as sportsbook prices post.</p>
      </div>
    );
  }

  const gap = signal.modelProbability - signal.marketProbability;
  const pick = signal.pickSide === "left" ? signal.left : signal.right;

  return (
    <div className={`${styles.marketGap} terminal-panel`}>
      <div className={styles.marketGapTopline}>
        <span>Biggest model / market gap</span>
        <b>{signal.sport}</b>
      </div>
      <strong>{pick.name}</strong>
      <p>
        {gap >= 0 ? "Model higher" : "Books higher"} by {points(gap)} on the current picked side.
      </p>
      <div className={styles.compareRows}>
        <CompareRow label="Independent model" value={signal.modelProbability} />
        <CompareRow label="Sportsbooks" value={signal.marketProbability} />
      </div>
      <Link href={signal.href}>Inspect the matchup ↗</Link>
    </div>
  );
}

function CompareRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.compareRow}>
      <div>
        <span>{label}</span>
        <strong className="tabnums">{pct(value)}</strong>
      </div>
      <div aria-hidden="true"><span style={{ width: pct(value) }} /></div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div>
      <span>{label}</span>
      <strong className="tabnums">{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function SectionHeading({
  index,
  title,
  detail,
}: {
  index: string;
  title: string;
  detail: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span>{index}</span>
      <h2>{title}</h2>
      <i />
      <small>{detail}</small>
    </div>
  );
}

function ContextCard({
  label,
  value,
  sub,
  live = false,
}: {
  label: string;
  value: string;
  sub: string;
  live?: boolean;
}) {
  return (
    <div className={styles.contextCard}>
      <span>{label}</span>
      <strong className={live ? styles.liveValue : undefined}>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function ExplainerStep({
  index,
  title,
  text,
}: {
  index: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <span>{index}</span>
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}

function roundLabel(id: string) {
  if (id.startsWith("r32")) return "World Cup · Round of 32";
  if (id.startsWith("r16")) return "World Cup · Round of 16";
  if (id.startsWith("qf")) return "World Cup · Quarter-final";
  if (id.startsWith("sf")) return "World Cup · Semi-final";
  return "World Cup · Final";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function lastName(name: string | null) {
  const parts = (name ?? "TBD").trim().split(/\s+/);
  return parts.at(-1) ?? "TBD";
}
