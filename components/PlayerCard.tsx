"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { Player } from "@/lib/match";
import type { CompetitionPlayerStats } from "@/lib/competition-types";
import PlayerFace from "./PlayerFace";
import Crest from "./Crest";
import PlayerMarkers from "./PlayerMarkers";
import { cardTheme } from "./theme";
import WatchlistButton from "./WatchlistButton";

// ESPN's free feed only carries these per-player keys — grouped FotMob-style.
// (xG, touches, passes, dribbles, tackles, duels and the heatmap come from
// Opta and aren't available here.)
// Real per-match events from ESPN, grouped FotMob-style. Rows with no value
// auto-hide, so a keeper shows the Goalkeeping block and an outfielder doesn't.
const STAT_SECTIONS: { title: string; rows: { key: string; label: string }[] }[] = [
  {
    title: "Attacking",
    rows: [
      { key: "totalGoals", label: "Goals" },
      { key: "goalAssists", label: "Assists" },
      { key: "totalShots", label: "Shots" },
      { key: "shotsOnTarget", label: "Shots on target" },
      { key: "offsides", label: "Offsides" },
    ],
  },
  {
    title: "Discipline",
    rows: [
      { key: "foulsSuffered", label: "Fouls won" },
      { key: "foulsCommitted", label: "Fouls committed" },
      { key: "yellowCards", label: "Yellow cards" },
      { key: "redCards", label: "Red cards" },
      { key: "ownGoals", label: "Own goals" },
    ],
  },
  {
    title: "Goalkeeping",
    rows: [
      { key: "saves", label: "Saves" },
      { key: "goalsConceded", label: "Goals conceded" },
      { key: "shotsFaced", label: "Shots faced" },
    ],
  },
];

// FotMob-style scale: green for a good game, orange around average, red below.
export function ratingColor(r: number): string {
  if (r >= 7) return "#1fa34a"; // green
  if (r >= 6) return "#f0a32e"; // orange
  return "#e0524f"; // red
}

export default function PlayerCard({
  player,
  teamKey,
  teamLogo,
  teamName,
  teamColor,
  teamAlt,
  onClose,
}: {
  player: Player;
  teamKey?: string;
  teamLogo?: string;
  teamName: string;
  teamColor?: string;
  teamAlt?: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const sections = STAT_SECTIONS.map((s) => ({
    title: s.title,
    rows: s.rows.filter((r) => player.stats?.[r.key] !== undefined),
  })).filter((s) => s.rows.length > 0);
  const [activeTab, setActiveTab] = useState<"competition" | "match">(
    sections.length > 0 ? "match" : "competition"
  );

  const posLabel =
    player.pos && player.pos.toUpperCase() !== "SUB"
      ? player.pos
      : player.bio?.position ?? "—";

  const t = cardTheme(teamColor, teamAlt);
  const roleLabel = player.starter ? "Starting XI" : "Substitute";
  const displayRating = player.rating ?? player.competition?.rating;
  const playerKey = player.id ?? player.afId ?? player.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const watchItem = {
    key: `player:${teamKey ?? teamName}:${playerKey}`,
    kind: "player" as const,
    title: player.name,
    context: `${teamName} · World Cup 2026`,
    href: `${pathname}#lineups`,
    image: player.headshot ?? player.photo ?? player.img ?? undefined,
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6 fade-up"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="terminal-panel relative flex max-h-[92vh] w-full max-w-[540px] flex-col overflow-hidden rounded-[22px] border-white/10 shadow-[0_34px_100px_-24px_rgba(0,0,0,0.95)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="player-card-title"
      >
        <div
          className="relative shrink-0 overflow-hidden px-5 pb-5 pt-5 sm:px-7 sm:pb-7 sm:pt-6"
          style={{ background: t.grad }}
        >
          {teamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo}
              alt=""
              className="pointer-events-none absolute -right-10 top-1/2 w-[58%] max-w-none -translate-y-1/2 opacity-[0.14] saturate-[1.35]"
            />
          )}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -80px 100px -80px rgba(0,0,0,0.7)",
            }}
          />

          <button
            onClick={onClose}
            autoFocus
            className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-black/30 text-[12px] text-white/80 transition hover:bg-black/55 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            aria-label="Close"
          >
            ✕
          </button>

          <div className="relative z-10 flex items-end gap-4 sm:gap-6">
            <div className="relative shrink-0">
              <div className="relative h-[122px] w-[108px] overflow-hidden rounded-[18px] border border-white/25 bg-black/15 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.8)] sm:h-[150px] sm:w-[132px]">
                <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/25 to-transparent" />
                <div className="absolute inset-0" style={{ color: t.ink }}>
                  <PlayerFace
                    srcs={[player.headshot, player.img, player.photo]}
                    jersey={player.jersey}
                    shape="square"
                  />
                </div>
              </div>
              <span
                className="absolute -bottom-2 -left-2 rounded-lg border border-white/20 bg-black/70 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-lg backdrop-blur"
              >
                #{player.jersey ?? "—"} · {posLabel}
              </span>
            </div>

            <div className="min-w-0 flex-1 pb-1 text-left">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className="rounded-full border border-current/25 bg-black/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em]"
                  style={{ color: t.ink }}
                >
                  {roleLabel}
                </span>
                {displayRating !== undefined && displayRating > 0 && (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tabnums text-white shadow-md ring-1 ring-black/25"
                    style={{ backgroundColor: ratingColor(displayRating) }}
                  >
                    {displayRating.toFixed(1)} {player.rating !== undefined ? "match" : "competition"}
                  </span>
                )}
                <WatchlistButton item={watchItem} compact />
              </div>
              <h3
                id="player-card-title"
                className="text-balance text-[24px] font-bold leading-[0.98] tracking-[-0.035em] sm:text-[32px]"
                style={{ color: t.ink, textShadow: "0 2px 8px rgba(0,0,0,0.24)" }}
              >
                {player.name}
              </h3>
              <div className="mt-3 flex items-center gap-2 text-[12px] font-semibold" style={{ color: t.sub }}>
                <Crest teamKey={teamKey} src={teamLogo} code={teamName} size={20} />
                <span className="truncate">{teamName}</span>
              </div>
              <div className="mt-2 min-h-5">
                <PlayerMarkers p={player} size="md" />
              </div>
            </div>
          </div>
        </div>

        <div
          className="grid shrink-0 grid-cols-2 border-b border-line bg-black/20 sm:grid-cols-4"
        >
          <InfoTile label="Position" value={posLabel} />
          <InfoTile label="Club" value={player.bio?.club ?? teamName} />
          <InfoTile label="Age" value={player.bio?.age !== undefined ? `${player.bio.age}` : player.competition?.age ? `${player.competition.age}` : "—"} />
          <InfoTile label="Nationality" value={player.bio?.nationality ?? player.competition?.nationality ?? teamName} />
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 grid grid-cols-2 rounded-lg border border-line/70 bg-black/20 p-1" role="tablist" aria-label="Player statistics">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "competition"}
              onClick={() => setActiveTab("competition")}
              className={`rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === "competition" ? "bg-accent/12 text-accent shadow-inner" : "text-muted hover:text-zinc-200"}`}
            >
              World Cup 2026
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "match"}
              onClick={() => setActiveTab("match")}
              className={`rounded-md px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${activeTab === "match" ? "bg-accent/12 text-accent shadow-inner" : "text-muted hover:text-zinc-200"}`}
            >
              This match
            </button>
          </div>

          {activeTab === "competition" ? (
            <CompetitionPanel stats={player.competition} />
          ) : (
            <>
              {(player.subbedIn || player.subbedOut) && (
                <div className="mb-4 flex flex-wrap gap-2 text-[11px]">
                  {player.subbedIn && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent/10 px-2.5 py-1 text-accent">
                      <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-accent/15 text-[10px] font-bold leading-none ring-1 ring-accent/30">↑</span>
                      came off the bench{player.subMinute ? ` · ${player.subMinute}` : ""}
                    </span>
                  )}
                  {player.subbedOut && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/25 bg-danger/10 px-2.5 py-1 text-danger">
                      <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-[#e0524f] text-[10px] font-bold leading-none text-white ring-1 ring-black/30">←</span>
                      substituted off{player.subMinute ? ` · ${player.subMinute}` : ""}
                    </span>
                  )}
                </div>
              )}

              {sections.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {sections.map((s) => (
                    <div key={s.title} className="rounded-xl border border-line/70 bg-white/[0.025] p-3.5">
                      <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">{s.title}</div>
                      <div className="divide-y divide-line/40">
                        {s.rows.map((r) => (
                          <div key={r.key} className="flex items-center justify-between py-2">
                            <span className="text-[12px] text-muted">{r.label}</span>
                            <span className="text-[13px] font-semibold tabnums text-zinc-100">{player.stats![r.key]}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-line/70 bg-white/[0.025] px-4 py-4">
                  <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.65)]" />
                    Match data pending
                  </div>
                  <p className="mt-2 text-[12px] leading-relaxed text-muted">Match stats and performance rating will populate once the game is underway.</p>
                </div>
              )}
            </>
          )}

          {player.bio?.desc && (
            <p className="mt-4 border-t border-line/40 pt-4 text-[11px] leading-relaxed text-muted line-clamp-5">
              {player.bio.desc}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CompetitionPanel({ stats }: { stats?: CompetitionPlayerStats }) {
  if (!stats) {
    return (
      <div className="rounded-xl border border-line/70 bg-white/[0.025] px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-300">Competition data unavailable</div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted">This player has not logged a World Cup appearance in the current competition feed.</p>
      </div>
    );
  }

  const role = stats.position === "Attacker" ? "Attack" : stats.position;
  const roleMetrics: [string, string | number][] =
    stats.position === "Goalkeeper"
      ? [["Clean sheets", stats.cleanSheets], ["Saves", stats.saves], ["Conceded", stats.conceded], ["Penalties saved", stats.penaltiesSaved]]
      : stats.position === "Defender"
        ? [["Defensive actions", stats.defensiveActions], ["Tackles", stats.tackles], ["Interceptions", stats.interceptions], ["Duels won", stats.duelsWon]]
        : stats.position === "Midfielder"
          ? [["Chances created", stats.keyPasses], ["Pass accuracy", `${stats.passAccuracy}%`], ["Duels won", stats.duelsWon], ["Ball wins", stats.tackles + stats.interceptions]]
          : [["Shots on target", stats.shotsOnTarget], ["Chances created", stats.keyPasses], ["Dribbles won", stats.dribblesWon], ["Shots", stats.shots]];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-accent/20 bg-accent/[0.055] px-4 py-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">{role} impact</div>
          <div className="mt-1 text-[11px] text-muted">Rank #{stats.roleRank} in the tournament</div>
        </div>
        <div className="text-right">
          <strong className="text-2xl font-bold tabnums text-zinc-100">{stats.impact}</strong>
          <span className="block text-[10px] uppercase tracking-[0.14em] text-muted">Impact score</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5">
        <CompetitionMetric label="Apps" value={stats.appearances} />
        <CompetitionMetric label="Starts" value={stats.starts} />
        <CompetitionMetric label="Minutes" value={stats.minutes} />
        <CompetitionMetric label="Rating" value={stats.rating.toFixed(2)} accent />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <CompetitionMetric label="Goals" value={stats.goals} />
        <CompetitionMetric label="Assists" value={stats.assists} />
        <CompetitionMetric label="G+A" value={stats.goalContributions} accent />
      </div>

      <div className="grid gap-1.5 sm:grid-cols-2">
        {roleMetrics.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between rounded-lg border border-line/60 bg-white/[0.02] px-3 py-2.5">
            <span className="text-[11px] text-muted">{label}</span>
            <strong className="text-[12px] font-semibold tabnums text-zinc-100">{value}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CompetitionMetric({ label, value, accent = false }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-line/60 bg-white/[0.025] px-2 py-2.5 text-center">
      <strong className={`block text-[14px] font-semibold tabnums ${accent ? "text-accent" : "text-zinc-100"}`}>{value}</strong>
      <span className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-muted">{label}</span>
    </div>
  );
}

function InfoTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-b border-line/50 px-4 py-3 text-left even:border-l sm:border-b-0 sm:border-l sm:first:border-l-0">
      <div className="truncate text-[12px] font-semibold text-zinc-100">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-muted">
        {label}
      </div>
    </div>
  );
}
