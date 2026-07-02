"use client";

import { useEffect, type ReactNode } from "react";
import type { Player } from "@/lib/match";
import PlayerFace from "./PlayerFace";
import Crest from "./Crest";
import PlayerMarkers from "./PlayerMarkers";

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
  onClose,
}: {
  player: Player;
  teamKey?: string;
  teamLogo?: string;
  teamName: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sections = STAT_SECTIONS.map((s) => ({
    title: s.title,
    rows: s.rows.filter((r) => player.stats?.[r.key] !== undefined),
  })).filter((s) => s.rows.length > 0);

  const posLabel =
    player.pos && player.pos.toUpperCase() !== "SUB"
      ? player.pos
      : player.bio?.position ?? "—";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[88vh] flex flex-col rounded-2xl border border-line bg-panel card-shadow overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="relative px-5 pt-6 pb-4 flex flex-col items-center text-center border-b border-line bg-panel2/60 shrink-0">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-muted hover:text-text text-sm"
            aria-label="Close"
          >
            ✕
          </button>
          <div className="relative">
            <PlayerFace srcs={[player.headshot, player.img]} jersey={player.jersey} size={76} />
            {player.rating !== undefined && (
              <span
                className="absolute -bottom-1 -right-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold tabnums text-white shadow-md"
                style={{ backgroundColor: ratingColor(player.rating) }}
              >
                {player.rating.toFixed(1)}
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2 text-lg font-semibold leading-tight">
            {player.name}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <PlayerMarkers p={player} size="md" />
          </div>
          {player.rating !== undefined && (
            <div className="mt-1 text-[10px] text-muted">
              {player.rating.toFixed(1)} · our match rating
            </div>
          )}

          {/* Position / Team / Age tiles */}
          <div className="mt-4 grid w-full grid-cols-3 divide-x divide-line/60 text-center">
            <Tile label="Position" value={posLabel} />
            <Tile
              label="Team"
              value={player.bio?.club ?? teamName}
              icon={
                <Crest teamKey={teamKey} src={teamLogo} code={teamName} size={14} />
              }
            />
            <Tile
              label="Age"
              value={player.bio?.age !== undefined ? `${player.bio.age}` : "—"}
            />
          </div>
        </div>

        {/* stats — scrollable */}
        <div className="overflow-y-auto px-5 py-4">
          {(player.subbedIn || player.subbedOut) && (
            <div className="mb-3 text-[11px]">
              {player.subbedIn && (
                <span className="text-accent">↑ came off the bench</span>
              )}
              {player.subbedOut && (
                <span className="text-danger">↓ substituted off</span>
              )}
            </div>
          )}

          {sections.length > 0 ? (
            <div className="space-y-4">
              {sections.map((s) => (
                <div key={s.title}>
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-300 mb-1.5">
                    {s.title}
                  </div>
                  <div className="divide-y divide-line/40">
                    {s.rows.map((r) => (
                      <div
                        key={r.key}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="text-[12px] text-muted">{r.label}</span>
                        <span className="text-[13px] font-semibold tabnums">
                          {player.stats![r.key]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-muted">
              No match stats yet — they populate once the game is underway.
            </div>
          )}

          {player.bio?.desc && (
            <p className="mt-4 pt-4 border-t border-line/40 text-[11px] text-muted leading-relaxed line-clamp-5">
              {player.bio.desc}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="px-1">
      <div className="flex items-center justify-center gap-1 text-sm font-semibold truncate">
        {icon}
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
    </div>
  );
}
