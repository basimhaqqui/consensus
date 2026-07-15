"use client";

import { useState } from "react";
import type {
  CompetitionPerformanceView,
  CompetitionPlayerStats,
  LeaderCategory,
} from "@/lib/competition-types";
import PlayerFace from "./PlayerFace";
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

function metric(player: CompetitionPlayerStats, category: LeaderCategory) {
  switch (category) {
    case "impact":
      return `${player.impact}`;
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
          <p>Every player, ranked by what they have delivered in this competition.</p>
        </div>
        <div className={styles.coverage}>
          <Coverage value={view.competition.playersTracked} label="Players" />
          <Coverage value={view.competition.matchesPlayed} label="Matches" />
          <Coverage value={`Live`} label={`Updated ${updated}`} live />
        </div>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Performance ranking">
        {CATEGORIES.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={category === item.key}
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
            </div>
            <div className={styles.spotlightImage}>
              <PlayerFace src={leader.photo} jersey={leader.number ? `${leader.number}` : undefined} shape="square" />
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className={styles.watermark} src={leader.teamLogo} alt="" />
          </article>

          <div className={styles.leaderList}>
            {leaders.slice(1).map((player, index) => (
              <article key={player.key} className={styles.leaderRow}>
                <span className={`${styles.rank} tabnums`}>{String(index + 2).padStart(2, "0")}</span>
                <PlayerFace src={player.photo} jersey={player.number ? `${player.number}` : undefined} size={42} />
                <div className={styles.playerCopy}>
                  <strong>{player.name}</strong>
                  <span>{player.teamName} · {supporting(player, category)}</span>
                </div>
                <div className={styles.rowMetric}>
                  <strong className="tabnums">{metric(player, category)}</strong>
                  <span>{metricLabel(category)}</span>
                </div>
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
                  <PlayerFace src={player.photo} jersey={player.number ? `${player.number}` : undefined} size={34} />
                  <div>
                    <strong>{player.name}</strong>
                    <small>{player.teamName} · {player.rating.toFixed(2)}</small>
                  </div>
                  <b className="tabnums">{player.impact}</b>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      <footer className={styles.methodology}>
        <span>Methodology</span>
        <p>Impact is a 0–99 role-adjusted score combining production, chance creation, ball progression, defending, duels, and goalkeeping. Competition totals refresh daily from API-Football.</p>
      </footer>
    </div>
  );
}

function Coverage({ value, label, live = false }: { value: string | number; label: string; live?: boolean }) {
  return (
    <div>
      <strong className="tabnums">{live && <i />} {value}</strong>
      <span>{label}</span>
    </div>
  );
}
