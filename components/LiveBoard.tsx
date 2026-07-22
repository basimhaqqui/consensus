"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SimRow } from "@/lib/bracket";
import { trackRecord, tournamentFav, type MatchView } from "@/lib/compute";
import type { RatingSource } from "@/lib/data";
import Crest from "./Crest";
import MatchCard from "./MatchCard";
import TitleRace from "./TitleRace";
import styles from "./LiveBoard.module.css";

type Board = { matches: MatchView[]; sim: SimRow[] };
type Payload = {
  live: boolean;
  blend: Board;
  model: Board;
  market: Board;
  updatedAt: string;
};

const REFRESH_MS = 30_000;
const INITIAL_UPCOMING = 3;
const INITIAL_RESULTS = 6;

const pct = (n: number) => `${Math.round(n * 100)}%`;

export default function LiveBoard({
  initial,
  archived = false,
}: {
  initial: Payload;
  archived?: boolean;
}) {
  const [data, setData] = useState<Payload>(initial);
  const [source, setSource] = useState<RatingSource>("blend");
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [showAllResults, setShowAllResults] = useState(false);

  useEffect(() => {
    if (archived) return;
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/scores", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        if (alive) setData(json);
      } catch {
        // Keep the last complete board if the live feed drops.
      }
    }
    const id = setInterval(pull, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [archived]);

  const board = data[source];
  const matches = board.matches;
  const live = matches
    .filter((m) => m.status === "live")
    .sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  const upcoming = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  const finals = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => b.kickoffISO.localeCompare(a.kickoffISO));

  const spotlight = live[0] ?? upcoming[0] ?? finals[0];
  const topTitle = board.sim[0];
  const strongest = [...live, ...upcoming].sort(
    (a, b) => b.confidence - a.confidence
  )[0];
  const marketWatch = data.model.matches
    .filter((m) => m.status !== "final" && m.market)
    .map((m) => ({
      match: m,
      edge: m.advance.home - m.market!.advHome,
    }))
    .sort((a, b) => Math.abs(b.edge) - Math.abs(a.edge))[0];

  const record = trackRecord(matches);
  const fav = tournamentFav(matches, source);
  const hitRate =
    record.played > 0 ? Math.round((record.hits / record.played) * 100) : null;

  const stages: [string, string, string][] = [
    ["r32-", "Round of 32", "32 → 16"],
    ["r16-", "Round of 16", "16 → 8"],
    ["qf-", "Quarter-finals", "8 → 4"],
    ["sf-", "Semi-finals", "4 → 2"],
    ["final", "Final", "2 → 1"],
  ];
  const stage =
    stages.find(([prefix]) =>
      matches.some((m) => m.id.startsWith(prefix) && m.status !== "final")
    ) ?? stages[stages.length - 1];

  const shownUpcoming = showAllUpcoming
    ? upcoming
    : upcoming.slice(0, INITIAL_UPCOMING);
  const shownResults = showAllResults
    ? finals
    : finals.slice(0, INITIAL_RESULTS);

  return (
    <div className={styles.board}>
      <div className={styles.controlBar}>
        <div>
          <span className={styles.controlLabel}>Forecast view</span>
          <div className="segmented-control inline-flex p-0.5 text-[10px] uppercase tracking-[0.14em]">
            <Toggle active={source === "blend"} onClick={() => setSource("blend")}>
              Consensus
            </Toggle>
            <Toggle active={source === "model"} onClick={() => setSource("model")}>
              Our model
            </Toggle>
            <Toggle active={source === "market"} onClick={() => setSource("market")}>
              Market
            </Toggle>
          </div>
        </div>
        <div className={styles.feedStatus}>
          <span className={archived ? styles.offlineDot : data.live ? "signal-dot" : styles.offlineDot} />
          <span>{archived ? "Final tournament record" : data.live ? "Live · ESPN" : "Feed offline"}</span>
          {!archived && <FeedAge updatedAt={data.updatedAt} />}
        </div>
      </div>

      <p className={styles.sourceDescription}>
        {source === "blend"
          ? "Consensus blends our tournament model with market-implied strength for the clearest current read."
          : source === "model"
            ? "Our independent Elo model, trained on more than 49,000 international results."
            : "Market-implied tournament strength and pre-match pricing."}
      </p>

      <section id="today" className={styles.today}>
        <div className={styles.todayHeading}>
          <div>
            <span className={archived ? styles.offlineDot : "signal-dot"} />
            <h2>{archived ? "Tournament closeout" : "Today&apos;s command center"}</h2>
          </div>
          <span>
            {archived
              ? `${finals.length} knockout results preserved`
              : live.length > 0
                ? `${live.length} live now`
                : `${upcoming.length} matches ahead`}
          </span>
        </div>

        <div className={styles.todayGrid}>
          {spotlight ? (
            <SpotlightMatch match={spotlight} />
          ) : (
            <div className={styles.emptySpotlight}>
              <span>No active matchup</span>
              <p>The board will update automatically when the next pairing is confirmed.</p>
            </div>
          )}

          <div className={styles.signalGrid}>
            <SignalCard
              label={archived ? "Final model leader" : "Title favorite"}
              value={topTitle?.name ?? fav?.name ?? "—"}
              sub={
                topTitle
                  ? `${pct(topTitle.champ)} to win across 10k simulations`
                  : "Waiting for the simulation board"
              }
            />
            <SignalCard
              label={archived ? "Open calls" : "Strongest call"}
              value={strongest ? strongestPick(strongest) : "No open call"}
              sub={
                strongest
                  ? `${strongest.home.code} vs ${strongest.away.code} · ${pct(Math.max(strongest.advance.home, strongest.advance.away))} to advance`
                  : "All current ties are decided"
              }
            />
            <SignalCard
              label={archived ? "Market comparison" : "Market watch"}
              value={marketWatch ? marketRead(marketWatch.match, marketWatch.edge) : "No line yet"}
              sub={
                marketWatch
                  ? `${marketWatch.match.home.code} vs ${marketWatch.match.away.code} · ${Math.abs(Math.round(marketWatch.edge * 100))}pt model gap`
                  : "Sportsbook comparison appears when lines post"
              }
              tone={marketWatch && Math.abs(marketWatch.edge) >= 0.08 ? "warn" : "default"}
            />
          </div>
        </div>

        <div className={styles.trustStrip}>
          <div>
            <span>Stage</span>
            <strong>{stage[1]}</strong>
            <small>{stage[2]}</small>
          </div>
          <div>
            <span>{sourceLabel(source)} record</span>
            <strong>{hitRate === null ? "—" : `${hitRate}%`}</strong>
            <small>{record.hits}/{record.played} knockout picks</small>
          </div>
          <div>
            <span>Top seed alive</span>
            <strong>{fav?.code ?? "—"}</strong>
            <small>{fav ? favoriteDetail(fav, source) : "Awaiting bracket"}</small>
          </div>
          <div>
            <span>{archived ? "Record" : "Feed"}</span>
            <strong>{archived ? "Closed" : data.live ? "Online" : "Fallback"}</strong>
            <small>{archived ? "Preserved after the final" : "Refreshes every 30 seconds"}</small>
          </div>
        </div>
      </section>

      {live.length > 0 && (
        <Section id="live" index="LIVE" title="Live now" count={live.length} accent>
          <Grid>
            {live.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </Grid>
        </Section>
      )}

      {board.sim.length > 0 && (
        <Section
          id="forecasts"
          index="02"
          title={archived ? "Final simulation board · 10k runs" : "Title race · 10k simulations"}
          count={board.sim.length}
        >
          <TitleRace rows={board.sim} />
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section id="matches" index="03" title="Upcoming matches" count={upcoming.length}>
          <Grid>
            {shownUpcoming.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </Grid>
          {upcoming.length > INITIAL_UPCOMING && (
            <RevealButton
              expanded={showAllUpcoming}
              onClick={() => setShowAllUpcoming((value) => !value)}
              total={upcoming.length}
              collapsed={INITIAL_UPCOMING}
              noun="matches"
            />
          )}
        </Section>
      )}

      {finals.length > 0 && (
        <Section id="results" index="04" title={archived ? "Knockout results" : "Recent results"} count={finals.length}>
          <Grid>
            {shownResults.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </Grid>
          {finals.length > INITIAL_RESULTS && (
            <RevealButton
              expanded={showAllResults}
              onClick={() => setShowAllResults((value) => !value)}
              total={finals.length}
              collapsed={INITIAL_RESULTS}
              noun="results"
            />
          )}
        </Section>
      )}
    </div>
  );
}

function SpotlightMatch({ match }: { match: MatchView }) {
  const advance = match.liveAdvance ?? match.advance;
  const isLive = match.status === "live";
  const isFinal = match.status === "final";
  const showScore = isLive || isFinal;

  return (
    <Link href={`/match/${match.id}`} className={styles.spotlight}>
      <div className={styles.spotlightTopline}>
        <span>{isLive ? "Live match" : isFinal ? "Latest result" : "Next kickoff"}</span>
        <strong className={isLive ? styles.liveText : undefined}>
          {isLive ? match.live?.clock ?? match.live?.detail : isFinal ? match.live?.detail ?? "FT" : match.date}
        </strong>
      </div>
      <div className={styles.spotlightMeta}>{match.venue}</div>
      <div className={styles.spotlightTeams}>
        <SpotlightTeam
          teamKey={match.homeKey}
          code={match.home.code}
          name={match.home.name}
          value={showScore ? String(match.score?.home ?? "—") : pct(advance.home)}
          winner={isFinal && match.winnerKey === match.homeKey}
        />
        <span className={styles.versus}>{isFinal ? "FT" : "vs"}</span>
        <SpotlightTeam
          teamKey={match.awayKey}
          code={match.away.code}
          name={match.away.name}
          value={showScore ? String(match.score?.away ?? "—") : pct(advance.away)}
          winner={isFinal && match.winnerKey === match.awayKey}
          right
        />
      </div>
      {!isFinal && (
        <div className={styles.advanceBlock}>
          <div>
            <span>To advance · including ET and penalties</span>
            <strong>{strongestPick(match)}</strong>
          </div>
          <div className={styles.advanceTrack} aria-hidden="true">
            <span style={{ width: pct(advance.home) }} />
          </div>
        </div>
      )}
      <div className={styles.spotlightFooter}>
        <span>{isFinal ? "Result, model grade, and match data" : "Forecast, expected score, and market comparison"}</span>
        <strong>Open match center ↗</strong>
      </div>
    </Link>
  );
}

function FeedAge({ updatedAt }: { updatedAt: string }) {
  const [label, setLabel] = useState("");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    const update = () => {
      const seconds = Math.max(
        0,
        Math.round((Date.now() - new Date(updatedAt).getTime()) / 1000)
      );
      const isStale = seconds > REFRESH_MS / 1000 * 3;
      setStale(isStale);
      setLabel(
        isStale
          ? `· stale ${Math.max(2, Math.round(seconds / 60))}m`
          : `· ${seconds}s ago`
      );
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [updatedAt]);

  return (
    <span className={`${styles.feedAge} ${stale ? "text-warn" : ""}`}>
      {label}
    </span>
  );
}

function SpotlightTeam({
  teamKey,
  code,
  name,
  value,
  winner,
  right = false,
}: {
  teamKey: string;
  code: string;
  name: string;
  value: string;
  winner: boolean;
  right?: boolean;
}) {
  return (
    <div className={`${styles.spotlightTeam} ${right ? styles.spotlightTeamRight : ""}`}>
      <div className={styles.spotlightIdentity}>
        <Crest teamKey={teamKey} code={code} size={34} />
        <div className={styles.spotlightName}>
          <span>{code}{winner ? " · advanced" : ""}</span>
          <strong>{name}</strong>
        </div>
      </div>
      <b className={`${styles.spotlightProbability} tabnums`}>{value}</b>
    </div>
  );
}

function SignalCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub: string;
  tone?: "default" | "warn";
}) {
  return (
    <div className={`${styles.signalCard} ${tone === "warn" ? styles.signalCardWarn : ""}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{sub}</small>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-[6px] px-3 py-1.5 transition-colors ${
        active
          ? "bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(52,211,153,0.16)]"
          : "text-muted hover:bg-white/[0.035] hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function Section({
  id,
  index,
  title,
  count,
  accent,
  children,
}: {
  id: string;
  index: string;
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-6 fade-up">
      <div
        className={`section-heading ${accent ? "section-heading--live" : ""}`}
        data-index={index}
      >
        <h2 className={accent ? "text-accent" : undefined}>{title}</h2>
        <span className="text-[11px] text-muted">[{count}]</span>
      </div>
      {children}
    </section>
  );
}

function RevealButton({
  expanded,
  onClick,
  total,
  collapsed,
  noun,
}: {
  expanded: boolean;
  onClick: () => void;
  total: number;
  collapsed: number;
  noun: string;
}) {
  return (
    <button type="button" onClick={onClick} className={styles.revealButton}>
      {expanded ? `Show fewer ${noun} ↑` : `Show all ${total} ${noun} · ${total - collapsed} more ↓`}
    </button>
  );
}

function strongestPick(match: MatchView) {
  const advance = match.liveAdvance ?? match.advance;
  return advance.home >= advance.away ? match.home.name : match.away.name;
}

function marketRead(match: MatchView, edge: number) {
  if (Math.abs(edge) < 0.03) return "Model and market agree";
  return edge > 0 ? `${match.home.code} rated higher` : `${match.away.code} rated higher`;
}

function sourceLabel(source: RatingSource) {
  return source === "blend" ? "Consensus" : source === "model" ? "Model" : "Market";
}

function favoriteDetail(
  favorite: { rating: number; marketRating?: number; titleOdds?: string },
  source: RatingSource
) {
  if (source === "market") return favorite.titleOdds ?? "Market leader";
  if (source === "blend") {
    return `Elo ${Math.round((favorite.rating + (favorite.marketRating ?? favorite.rating)) / 2)}`;
  }
  return `Elo ${favorite.rating}`;
}
