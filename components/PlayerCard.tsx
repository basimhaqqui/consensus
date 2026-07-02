"use client";

import { useEffect, type ReactNode } from "react";
import type { Player } from "@/lib/match";
import PlayerFace from "./PlayerFace";
import Crest from "./Crest";
import PlayerMarkers from "./PlayerMarkers";
import { cardTheme } from "./theme";

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

  const t = cardTheme(teamColor, teamAlt);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm fade-up"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm max-h-[88vh] flex flex-col rounded-2xl border border-line bg-panel card-shadow overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header — the player's FUT card, blown up */}
        <div
          className="relative flex flex-col items-center overflow-hidden px-5 pt-6 pb-4 text-center shrink-0"
          style={{ background: t.grad }}
        >
          {/* crest watermark — the team's identity behind the player */}
          {teamLogo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={teamLogo}
              alt=""
              className="pointer-events-none absolute left-1/2 top-[42%] w-[62%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.16] saturate-[1.4]"
            />
          )}
          {/* rim + top shine */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 0 0 1px rgba(0,0,0,0.35)",
            }}
          />

          <button
            onClick={onClose}
            className="absolute top-2.5 right-2.5 z-20 grid h-6 w-6 place-items-center rounded-full bg-black/40 text-[11px] text-white hover:bg-black/60"
            aria-label="Close"
          >
            ✕
          </button>

          {/* jersey number + position, card-style top-left */}
          <div className="absolute left-4 top-3.5 z-10 flex flex-col items-start">
            <span
              className="text-xl font-extrabold tabnums leading-none"
              style={{ color: t.ink, textShadow: "0 1px 2px rgba(0,0,0,0.25)" }}
            >
              {player.jersey}
            </span>
            <span
              className="mt-0.5 text-[10px] font-bold uppercase tracking-wide leading-none"
              style={{ color: t.sub }}
            >
              {posLabel}
            </span>
          </div>

          <div className="relative z-10">
            <div className="relative h-[92px] w-[92px]" style={{ color: t.ink }}>
              <PlayerFace
                srcs={[player.headshot, player.img]}
                jersey={player.jersey}
                shape="square"
              />
            </div>

            {/* rating pill — top-right of the face, FotMob colours */}
            {player.rating !== undefined && (
              <span
                className="absolute -right-6 top-0 rounded-full px-2 py-0.5 text-[13px] font-bold tabnums text-white shadow-md ring-1 ring-black/30"
                style={{ backgroundColor: ratingColor(player.rating) }}
              >
                {player.rating.toFixed(1)}
              </span>
            )}
          </div>

          <div
            className="relative z-10 mt-1.5 flex items-center gap-2 text-lg font-bold leading-tight"
            style={{ color: t.ink, textShadow: "0 1px 2px rgba(0,0,0,0.3)" }}
          >
            {player.name}
          </div>
          <div className="relative z-10 mt-1.5 flex items-center gap-2">
            <PlayerMarkers p={player} size="md" />
          </div>
          {player.rating !== undefined && (
            <div className="relative z-10 mt-1 text-[10px]" style={{ color: t.sub }}>
              our match rating
            </div>
          )}
        </div>

        {/* Position / Team / Age tiles — name-band colours */}
        <div
          className="grid w-full grid-cols-3 divide-x divide-black/15 border-b border-line px-2 py-2 text-center shrink-0"
          style={{ background: t.bandBg, color: t.bandInk }}
        >
          <Tile label="Position" value={posLabel} ink={t.bandInk} />
          <Tile
            label="Team"
            value={player.bio?.club ?? teamName}
            ink={t.bandInk}
            icon={
              <Crest teamKey={teamKey} src={teamLogo} code={teamName} size={14} />
            }
          />
          <Tile
            label="Age"
            value={player.bio?.age !== undefined ? `${player.bio.age}` : "—"}
            ink={t.bandInk}
          />
        </div>

        {/* stats — scrollable */}
        <div className="overflow-y-auto px-5 py-4">
          {(player.subbedIn || player.subbedOut) && (
            <div className="mb-3 flex flex-col gap-1.5 text-[11px]">
              {player.subbedIn && (
                <span className="inline-flex items-center gap-1.5 text-accent">
                  <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-accent/15 text-[10px] font-bold leading-none ring-1 ring-accent/30">
                    ↑
                  </span>
                  came off the bench{player.subMinute ? ` · ${player.subMinute}` : ""}
                </span>
              )}
              {player.subbedOut && (
                <span className="inline-flex items-center gap-1.5 text-danger">
                  <span className="inline-grid h-4 w-4 place-items-center rounded-full bg-[#e0524f] text-[10px] font-bold leading-none text-white ring-1 ring-black/30">
                    ←
                  </span>
                  substituted off{player.subMinute ? ` · ${player.subMinute}` : ""}
                </span>
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
  ink,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  ink?: string;
}) {
  return (
    <div className="px-1" style={ink ? { color: ink } : undefined}>
      <div className="flex items-center justify-center gap-1 text-sm font-semibold truncate">
        {icon}
        <span className="truncate">{value}</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider opacity-70">
        {label}
      </div>
    </div>
  );
}
