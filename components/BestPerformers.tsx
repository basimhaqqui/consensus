"use client";

import { useState } from "react";
import type {
  CompetitionPerformanceView,
  CompetitionPlayerStats,
  LeaderCategory,
} from "@/lib/competition-types";
import PlayerFace from "./PlayerFace";
import WatchlistButton from "./WatchlistButton";
import styles from "./BestPerformers.module.css";

const CATEGORIES: { key: LeaderCategory; label: string; short: string }[] = [
  { key: "impact", label: "Overall impact", short: "Impact" },
  { key: "goals", label: "Most goals", short: "Goals" },
  { key: "assists", label: "Most assists", short: "Assists" },
  { key: "contributions", label: "Goals + assists", short: "G+A" },
  { key: "rating", label: "Best rating", short: "Rating" },
  { key: "chances", label: "Chances created", short: "Chances" },
  { key: "cleanSheets", label: "Clean sheets", short: "Clean sheets" },
  { key: "ballWins", label: "Ball wins", short: "Ball wins" },
  { key: "shotsOnTarget", label: "Shots on target", short: "On target" },
  { key: "saves", label: "Most saves", short: "Saves" },
];

const ROLES = [
  { key: "Attacker", label: "Attack", code: "ATT" },
  { key: "Midfielder", label: "Midfield", code: "MID" },
  { key: "Defender", label: "Defense", code: "DEF" },
  { key: "Goalkeeper", label: "Goalkeeping", code: "GK" },
] as const;

// Only use verified cross-provider mappings. API-Football and ESPN IDs are
// unrelated, so constructing a URL from the wrong provider can show another
// player's face.
const SPOTLIGHT_PHOTOS: Record<number, string> = {
  154: "https://a.espncdn.com/i/headshots/soccer/players/full/45843.png",
};

function metric(player: CompetitionPlayerStats, category: LeaderCategory) {
  switch (category) {
    case "impact":
      return player.impact.toFixed(1);
    case "goals":
      return `${player.goals}`;
    case "assists":
      return `${player.assists}`;
    case "contributions":
      return `${player.goalContributions}`;
    case "rating":
      return player.rating.toFixed(2);
    case "chances":
      return `${player.keyPasses}`;
    case "cleanSheets":
      return `${player.cleanSheets}`;
    case "ballWins":
      return `${player.tackles + player.interceptions}`;
    case "shotsOnTarget":
      return `${player.shotsOnTarget}`;
    case "saves":
      return `${player.saves}`;
  }
}

function metricLabel(category: LeaderCategory) {
  switch (category) {
    case "impact":
      return "impact";
    case "rating":
      return "rating";
    case "contributions":
      return "G+A";
    case "chances":
      return "created";
    case "cleanSheets":
      return "clean sheets";
    case "ballWins":
      return "ball wins";
    case "shotsOnTarget":
      return "on target";
    default:
      return category;
  }
}

function supporting(player: CompetitionPlayerStats, category: LeaderCategory) {
  if (category === "impact") return `${player.rating.toFixed(2)} rating · ${player.minutes} min`;
  if (category === "rating") return `${player.minutes} min · ${player.appearances} apps`;
  if (category === "cleanSheets") return `${player.saves} saves · ${player.conceded} conceded`;
  if (category === "saves") return `${player.cleanSheets} clean sheets · ${player.appearances} apps`;
  if (category === "ballWins") return `${player.tackles} tackles · ${player.interceptions} interceptions`;
  if (category === "chances") return `${player.assists} assists · ${player.passAccuracy}% passing`;
  return `${player.rating.toFixed(2)} rating · ${player.appearances} apps`;
}

export default function BestPerformers({ view }: { view: CompetitionPerformanceView }) {
  const [category, setCategory] = useState<LeaderCategory>("impact");
  const leaders = view.categories[category];
  const leader = leaders[0];
  const categoryMeta = CATEGORIES.find((item) => item.key === category)!;
  const updated = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(view.competition.updatedAt));

  return (
    <div className={`terminal-panel blueprint-surface ${styles.board}`}>
      <div className={styles.header}>
        <div>
          <span className={styles.eyebrow}>Tournament performance center</span>
          <h3>{view.competition.name} <span>{view.competition.season}</span></h3>
          <p>Competition leaders ranked by verified tournament production, with a 180-minute minimum for impact lists.</p>
        </div>
        <div className={styles.coverage}>
          <Coverage value={view.competition.playersTracked} label="Players" />
          <Coverage value={view.competition.matchesPlayed} label="Matches" />
          <Coverage value="Daily" label={`${view.competition.source} · ${updated}`} verified />
        </div>
      </div>

      <div className={styles.tabs} role="group" aria-label="Performance ranking">
        {CATEGORIES.map((item) => (
          <button
            key={item.key}
            type="button"
            aria-pressed={category === item.key}
            onClick={() => setCategory(item.key)}
            className={category === item.key ? styles.activeTab : undefined}
          >
            {item.short}
          </button>
        ))}
      </div>

      {leader && (
        <div className={styles.rankingGrid}>
          <article className={styles.spotlight}>
            <div className={styles.spotlightGlow} aria-hidden="true" />
            <div className={styles.spotlightCopy}>
              <span className={styles.rankLabel}>01 / {categoryMeta.label}</span>
              <strong className={styles.leaderName}>{leader.name}</strong>
              <span className={styles.leaderTeam}>{leader.teamName} · {leader.position}</span>
              <div className={styles.heroMetric}>
                <strong className="tabnums">{metric(leader, category)}</strong>
                <span>{metricLabel(category)}</span>
              </div>
              <p>{supporting(leader, category)}</p>
              <WatchlistButton
                compact
                className="mt-4"
                item={{
                  key: `player:${leader.key}`,
                  kind: "player",
                  title: leader.name,
                  context: `${leader.teamName} · ${leader.position}`,
                  href: "/wc#performers",
                  image: leader.photo,
                }}
              />
            </div>
            <div className={styles.spotlightImage}>
              <PlayerFace
                srcs={[
                  SPOTLIGHT_PHOTOS[leader.id],
                  leader.photo,
                ].filter(Boolean) as string[]}
                name={leader.name}
                jersey={leader.number ? `${leader.number}` : undefined}
                size={188}
                relaxed
                priority
              />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.watermark} src={leader.teamLogo} alt="" />
          </article>

          <div className={styles.leaderList}>
            {leaders.slice(1).map((player, index) => (
              <article key={player.key} className={styles.leaderRow}>
                <span className={`${styles.rank} tabnums`}>{String(index + 2).padStart(2, "0")}</span>
                <PlayerFace
                  src={player.photo}
                  name={player.name}
                  jersey={player.number ? `${player.number}` : undefined}
                  size={42}
                />
                <div className={styles.playerCopy}>
                  <strong>{player.name}</strong>
                  <span>{player.teamName} · {supporting(player, category)}</span>
                </div>
                <div className={styles.rowMetric}>
                  <strong className="tabnums">{metric(player, category)}</strong>
                  <span>{metricLabel(category)}</span>
                </div>
                <WatchlistButton
                  iconOnly
                  item={{
                    key: `player:${player.key}`,
                    kind: "player",
                    title: player.name,
                    context: `${player.teamName} · ${player.position}`,
                    href: "/wc#performers",
                    image: player.photo,
                  }}
                />
              </article>
            ))}
          </div>
        </div>
      )}

      <div className={styles.rolesHeader}>
        <div>
          <span className={styles.eyebrow}>Role-adjusted leaders</span>
          <h4>Most impactful by position</h4>
        </div>
        <p>Minimum 180 tournament minutes</p>
      </div>

      <div className={styles.roleGrid}>
        {ROLES.map((role) => (
          <article key={role.key} className={styles.roleCard}>
            <div className={styles.roleTitle}>
              <span>{role.code}</span>
              <strong>{role.label}</strong>
            </div>
            <div className={styles.rolePlayers}>
              {view.roles[role.key].slice(0, 3).map((player, index) => (
                <div key={player.key} className={styles.rolePlayer}>
                  <span className="tabnums">{index + 1}</span>
                  <PlayerFace
                    src={player.photo}
                    name={player.name}
                    jersey={player.number ? `${player.number}` : undefined}
                    size={34}
                  />
                  <div>
                    <strong>{player.name}</strong>
                    <small>{player.teamName} · {player.rating.toFixed(2)}</small>
                  </div>
                  <b className="tabnums">{player.impact.toFixed(1)}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <footer className={styles.methodology}>
        <span>Methodology</span>
        <p>Impact is a 0–100 role-adjusted index combining production, chance creation, ball progression, defending, duels, and goalkeeping. Scores use one decimal to preserve ranking separation. Competition totals refresh daily from API-Football.</p>
      </footer>
    </div>
  );
}

function Coverage({
  value,
  label,
  verified = false,
}: {
  value: string | number;
  label: string;
  verified?: boolean;
}) {
  return (
    <div>
      <strong className="tabnums">{verified && <i />} {value}</strong>
      <span>{label}</span>
    </div>
  );
}
