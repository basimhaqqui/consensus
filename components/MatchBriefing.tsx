import Crest from "./Crest";
import MatchShareButton from "./MatchShareButton";
import type { MatchView } from "@/lib/compute";
import { TEAMS } from "@/lib/data";
import type { Brief } from "@/lib/briefs";
import type { MatchDetail } from "@/lib/match";
import styles from "./MatchBriefing.module.css";

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function MatchBriefing({
  match,
  detail,
  brief,
}: {
  match: MatchView;
  detail: MatchDetail | null;
  brief?: Brief;
}) {
  const advance = match.liveAdvance ?? match.advance;
  const outcome = match.liveProb ?? match.outcome;
  const homePick = advance.home >= advance.away;
  const pick = homePick ? match.home : match.away;
  const pickProbability = homePick ? advance.home : advance.away;
  const margin = Math.abs(advance.home - advance.away);
  const decided = detail?.status === "post" || match.status === "final";
  const live = detail?.status === "in" || match.status === "live";
  const score = detail?.home.score !== undefined && detail?.away.score !== undefined
    ? `${detail.home.score}–${detail.away.score}`
    : match.score
      ? `${match.score.home}–${match.score.away}`
      : undefined;
  const marketPickProbability = match.market
    ? homePick
      ? match.market.advHome
      : 1 - match.market.advHome
    : undefined;
  const shareTitle = `${match.home.name} vs ${match.away.name} — CONSENSUS`;
  const shareText = decided && score
    ? `${match.home.name} ${score} ${match.away.name}. See the pre-match forecast, timeline, and match data.`
    : `${pick.name} ${pct(pickProbability)} to advance. ${match.home.name} vs ${match.away.name} match intelligence.`;
  const reasons = buildReasons(match, homePick, pickProbability, marketPickProbability);

  return (
    <div className={styles.briefing}>
      <section className={`terminal-panel blueprint-surface ${styles.hero}`}>
        <div className={styles.heroTop}>
          <div className={styles.heroKicker}>
            <strong>{roundLabel(match.id)}</strong> · Match intelligence
          </div>
          <div className={styles.status}>
            {live && <span className="signal-dot" />}
            <span className={live ? styles.statusLive : undefined}>
              {live ? detail?.detail ?? "Live" : decided ? detail?.detail ?? "Full time" : "Pre-match briefing"}
            </span>
          </div>
          <MatchShareButton title={shareTitle} text={shareText} />
        </div>

        <div className={styles.matchup}>
          <Team
            teamKey={match.homeKey}
            name={match.home.name}
            code={match.home.code}
            form={detail?.form?.home}
          />
          <div className={styles.matchState}>
            <strong>{score && (live || decided) ? score : match.date}</strong>
            <span>{score && (live || decided) ? live ? detail?.detail ?? "Live" : "Full time" : detail?.detail ?? "Kickoff"}</span>
          </div>
          <Team
            teamKey={match.awayKey}
            name={match.away.name}
            code={match.away.code}
            form={detail?.form?.away}
            away
          />
        </div>

        <div className={styles.heroMeta}>
          <span>{match.venue}{detail?.venue ? ` · ${detail.venue}` : ""}</span>
          <span>{detail?.referee ? `Referee ${detail.referee}` : "World Cup 2026 knockout stage"}</span>
        </div>
      </section>

      <nav aria-label="Match sections" className={`segmented-control ${styles.sectionNav}`}>
        <a href="#forecast">Forecast</a>
        <a href="#why">Why this call</a>
        {match.status === "scheduled" && <a href="#markets">Markets</a>}
        <a href="#lineups">Lineups</a>
        <a href="#history">History</a>
        <a href="#news">News</a>
      </nav>

      <div className={styles.intelligenceGrid}>
        <section id="forecast" className={`terminal-panel ${styles.forecast}`}>
          <div className={styles.panelHeading}>
            <h2>01 / Consensus call</h2>
            <span className={`${styles.confidence} ${decided && match.hit === false ? styles.confidenceMiss : ""}`}>
              {decided
                ? match.hit === true
                  ? "Model hit"
                  : match.hit === false
                    ? "Model miss"
                    : "Awaiting grade"
                : confidenceLabel(margin)}
            </span>
          </div>

          <div className={styles.pickTopline}>
            <div>
              <span className={styles.panelEyebrow}>{live ? "Live projection" : decided ? "Pre-match forecast" : "To advance"}</span>
              <div className={styles.pickName}>{pick.name}</div>
            </div>
            <strong className={`${styles.pickProbability} tabnums`}>{pct(pickProbability)}</strong>
          </div>
          <p className={styles.pickCaption}>
            {decided
              ? `Graded after the final whistle · ${match.hit === true ? "model hit" : match.hit === false ? "model miss" : "result pending"}`
              : `Including extra time and penalties · ${Math.round(margin * 100)} point edge`}
          </p>

          <div className={styles.probability}>
            <div className={styles.probabilityLabels}>
              <span><strong>{match.home.code}</strong> {pct(advance.home)}</span>
              <span>{pct(advance.away)} <strong>{match.away.code}</strong></span>
            </div>
            <div className={styles.probabilityTrack} aria-label={`${match.home.name} ${pct(advance.home)}, ${match.away.name} ${pct(advance.away)} to advance`}>
              <span style={{ width: pct(advance.home) }} />
              <span />
            </div>
          </div>

          <div className={styles.outcome}>
            <span className={styles.panelEyebrow}>{live ? "Current 90-minute outcome" : "90-minute outcome"}</span>
            <div className={styles.outcomeLabels}>
              <span><strong className="tabnums">{pct(outcome.pHome)}</strong>{match.home.code}</span>
              <span><strong className="tabnums">{pct(outcome.pDraw)}</strong>Draw</span>
              <span><strong className="tabnums">{pct(outcome.pAway)}</strong>{match.away.code}</span>
            </div>
            <div className={styles.outcomeTrack} aria-hidden="true">
              <span style={{ width: pct(outcome.pHome) }} />
              <span style={{ width: pct(outcome.pDraw) }} />
              <span style={{ width: pct(outcome.pAway) }} />
            </div>
          </div>

          <div className={styles.statGrid}>
            <ForecastStat label="Expected goals" value={`${match.outcome.lambdaHome.toFixed(1)} – ${match.outcome.lambdaAway.toFixed(1)}`} />
            <ForecastStat label="Likely score" value={`${match.outcome.topScore.home} – ${match.outcome.topScore.away}`} />
            <ForecastStat label="Model fair price" value={homePick ? match.homeML : match.awayML} />
          </div>
        </section>

        <section id="why" className={`terminal-panel ${styles.reasoning}`}>
          <div className={styles.panelHeading}>
            <h2>02 / Why {pick.name}</h2>
            <span className={styles.panelEyebrow}>Transparent model</span>
          </div>

          <ol className={styles.reasonList}>
            {reasons.map((reason, index) => (
              <li key={reason.title} className={styles.reason}>
                <span className={styles.reasonIndex}>0{index + 1}</span>
                <div>
                  <strong>{reason.title}</strong>
                  <p>{reason.detail}</p>
                </div>
              </li>
            ))}
          </ol>

          {marketPickProbability !== undefined && (
            <div className={styles.marketCompare}>
              <span>Consensus vs books · {pick.code} to advance</span>
              <MarketRow label="Consensus" value={pickProbability} />
              <MarketRow label="Sportsbooks" value={marketPickProbability} />
            </div>
          )}

          {brief && (
            <div className={styles.brief}>
              <span>Latest briefing</span>
              <p>{brief.text}</p>
              {brief.sources.length > 0 && (
                <div className={styles.briefSources}>
                  {brief.sources.slice(0, 3).map((source) => (
                    <a key={source.href} href={source.href} target="_blank" rel="noopener noreferrer">
                      {source.headline} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className={styles.briefingFooter}>
            <p>10,000 simulations · live ESPN state · market-calibrated strength. For entertainment, not betting advice.</p>
            <MatchShareButton title={shareTitle} text={shareText} />
          </div>
        </section>
      </div>

      <div className={styles.mobileShare}>
        <MatchShareButton title={shareTitle} text={shareText} compact />
      </div>
    </div>
  );
}

function Team({
  teamKey,
  name,
  code,
  form,
  away = false,
}: {
  teamKey: string;
  name: string;
  code: string;
  form?: string[];
  away?: boolean;
}) {
  return (
    <div className={`${styles.team} ${away ? styles.teamAway : ""}`}>
      <Crest teamKey={teamKey} code={code} size={56} />
      <div className={styles.teamCopy}>
        <span className={styles.teamCode}>{code} · {TEAMS[teamKey].titleOdds ?? "World Cup"}</span>
        <strong className={styles.teamName}>{name}</strong>
        {form && form.length > 0 && (
          <div className={styles.form} title="Last five matches, oldest first">
            {form.map((result, index) => (
              <span
                key={`${result}-${index}`}
                className={result === "W" ? styles.formWin : result === "D" ? styles.formDraw : styles.formLoss}
              >
                {result}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ForecastStat({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.stat}>
      <span>{label}</span>
      <strong className="tabnums">{value}</strong>
    </div>
  );
}

function MarketRow({ label, value }: { label: string; value: number }) {
  return (
    <div className={styles.marketRow}>
      <div className={styles.marketLabels}>
        <span>{label}</span>
        <strong className="tabnums">{pct(value)}</strong>
      </div>
      <div className={styles.marketTrack} aria-hidden="true">
        <span style={{ width: pct(value) }} />
        <span />
      </div>
    </div>
  );
}

function buildReasons(
  match: MatchView,
  homePick: boolean,
  pickProbability: number,
  marketPickProbability?: number
) {
  const pick = homePick ? match.home : match.away;
  const opponent = homePick ? match.away : match.home;
  const pickRating = blendedRating(pick);
  const opponentRating = blendedRating(opponent);
  const ratingGap = Math.abs(Math.round(pickRating - opponentRating));
  const xgPick = homePick ? match.outcome.lambdaHome : match.outcome.lambdaAway;
  const xgOpponent = homePick ? match.outcome.lambdaAway : match.outcome.lambdaHome;
  const draw = match.outcome.pDraw;
  const reasons = [
    {
      title: ratingGap >= 5 ? `${ratingGap}-point strength edge` : "Near-even strength ratings",
      detail: ratingGap >= 5
        ? `${pick.name} grades higher in the blended Elo and market-strength baseline used by the consensus model.`
        : `${pick.name} and ${opponent.name} are separated by very little in the underlying strength inputs.`,
    },
    {
      title: `${xgPick.toFixed(1)}–${xgOpponent.toFixed(1)} expected-goal profile`,
      detail: Math.abs(xgPick - xgOpponent) < 0.25
        ? "The chance-quality edge is narrow, so one high-leverage moment can swing the tie."
        : `${pick.name} creates the stronger projected scoring profile over 90 minutes.`,
    },
    {
      title: `${pct(draw)} chance of extra-time pressure`,
      detail: `The model prices the 90-minute draw heavily; the ${pct(pickProbability)} call includes extra time and penalties.`,
    },
  ];
  if (marketPickProbability !== undefined) {
    const delta = Math.round((pickProbability - marketPickProbability) * 100);
    reasons.push({
      title: Math.abs(delta) < 3 ? "Books broadly agree" : `${Math.abs(delta)}-point ${delta > 0 ? "model" : "market"} gap`,
      detail: Math.abs(delta) < 3
        ? `Consensus and sportsbook prices land within ${Math.abs(delta)} points on ${pick.name}.`
        : delta > 0
          ? `Consensus is more confident in ${pick.name} than the current sportsbook-implied advance price.`
          : `Sportsbooks are more confident in ${pick.name} than the consensus projection.`,
    });
  }
  return reasons;
}

function blendedRating(team: MatchView["home"]) {
  return (team.rating + (team.marketRating ?? team.rating)) / 2;
}

function confidenceLabel(margin: number) {
  if (margin < 0.08) return "Coin flip";
  if (margin < 0.18) return "Lean";
  return "Strong call";
}

function roundLabel(id: string) {
  if (id.startsWith("r32-")) return "Round of 32";
  if (id.startsWith("r16-")) return "Round of 16";
  if (id.startsWith("qf-")) return "Quarter-final";
  if (id.startsWith("sf-")) return "Semi-final";
  if (id.startsWith("final")) return "Final";
  return "Knockout match";
}
