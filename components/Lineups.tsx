"use client";

import { useState } from "react";
import type { Player, Squad } from "@/lib/match";
import { PitchDuo, bandRank } from "./Pitch";
import PlayerFace from "./PlayerFace";
import Crest from "./Crest";
import PlayerCard, { ratingColor } from "./PlayerCard";
import PlayerMarkers from "./PlayerMarkers";

export default function Lineups({
  squads,
  status,
}: {
  squads: Squad[];
  status?: "pre" | "in" | "post";
}) {
  const [sel, setSel] = useState<{ player: Player; squad: Squad } | null>(null);
  const select = (player: Player, squad: Squad) => setSel({ player, squad });

  const home = squads.find((s) => s.homeAway === "home") ?? squads[0];
  const away = squads.find((s) => s.homeAway === "away") ?? squads[1] ?? home;
  const predicted = !!(home.predicted || away.predicted);

  return (
    <div>
      <div className="terminal-panel overflow-hidden">
        <div className="terminal-panel-header relative grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-3 sm:gap-4 sm:px-5 sm:py-4">
          <TeamTag sq={home} />
          {predicted ? (
            <span className="rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300 whitespace-nowrap sm:text-[10px]">
              Projected XI
            </span>
          ) : (
            status === "pre" && (
              <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-accent whitespace-nowrap sm:text-[10px]">
                Confirmed
              </span>
            )
          )}
          <TeamTag sq={away} align="right" />
        </div>
        <div className="flex items-center justify-between border-b border-line/50 bg-black/15 px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted sm:px-5">
          <span>{predicted ? "Latest available shape" : "Official team sheet"}</span>
          <span className="hidden sm:inline">Select a player for profile + match stats</span>
          <span className="sm:hidden">Tap a player</span>
        </div>
        <div className="p-2.5 sm:p-3.5">
          {/* vertical pitch on phones (FotMob style), horizontal on wider screens */}
          <div className="sm:hidden">
            <PitchDuo home={home} away={away} onSelect={select} orient="v" />
          </div>
          <div className="hidden sm:block">
            <PitchDuo home={home} away={away} onSelect={select} orient="h" />
          </div>
        </div>
        {predicted && (
          <div className="border-t border-line/50 bg-black/10 px-4 py-2.5 text-center text-[10px] leading-relaxed text-muted">
            Projected from recent selections and each side&apos;s latest available shape.
            Official lineups usually arrive about an hour before kickoff.
          </div>
        )}
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <Bench sq={home} onSelect={(p) => select(p, home)} />
        {away !== home && (
          <Bench sq={away} onSelect={(p) => select(p, away)} />
        )}
      </div>

      {sel && (
        <PlayerCard
          player={sel.player}
          teamKey={sel.squad.key}
          teamLogo={sel.squad.logo}
          teamName={sel.squad.name}
          teamColor={sel.squad.color}
          teamAlt={sel.squad.alt}
          onClose={() => setSel(null)}
        />
      )}
    </div>
  );
}

function TeamTag({ sq, align }: { sq: Squad; align?: "right" }) {
  return (
    <div
      className={`flex min-w-0 items-center gap-2.5 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line/70 bg-white/[0.035] shadow-inner sm:h-9 sm:w-9">
        <Crest teamKey={sq.key} src={sq.logo} code={sq.abbr} size={23} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold text-zinc-100 sm:text-sm">
          <span className="hidden sm:inline">{sq.name}</span>
          <span className="sm:hidden">{sq.abbr}</span>
        </span>
        <span className={`mt-0.5 flex items-center gap-1.5 ${align === "right" ? "justify-end" : ""}`}>
          <span className="hidden text-[10px] uppercase tracking-[0.15em] text-muted sm:inline">Formation</span>
          <span className="whitespace-nowrap text-[10px] font-semibold tabnums text-accent sm:text-[11px]">
            {sq.formation ?? "—"}
          </span>
        </span>
      </span>
    </div>
  );
}

const unresolved = (p: Player) => p.pos.toUpperCase() === "SUB" || p.pos === "";

const byJersey = (a: Player, b: Player) =>
  (Number(a.jersey) || 99) - (Number(b.jersey) || 99);

// Full position word shown under each bench player's name (FotMob style).
function posWord(p: Player): string {
  if (unresolved(p)) return "Substitute";
  return { GK: "Keeper", DEF: "Defender", MID: "Midfielder", FWD: "Attacker" }[
    p.band
  ];
}

// Sort GK → DEF → MID → FWD, unresolved players last.
const benchRank = (p: Player) => (unresolved(p) ? 9 : bandRank(p));

function Bench({
  sq,
  onSelect,
}: {
  sq: Squad;
  onSelect: (p: Player) => void;
}) {
  const bench = [...sq.subs].sort(
    (a, b) => benchRank(a) - benchRank(b) || byJersey(a, b)
  );
  if (bench.length === 0) return null;

  return (
    <div className="terminal-panel overflow-hidden">
      <div className="terminal-panel-header flex items-center gap-2.5 px-4 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-line/70 bg-white/[0.035]">
          <Crest teamKey={sq.key} src={sq.logo} code={sq.abbr} size={18} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[12px] font-semibold text-zinc-100">{sq.name}</span>
          <span className="block text-[10px] uppercase tracking-[0.15em] text-muted">Available substitutes</span>
        </span>
        <span className="ml-auto rounded-full border border-line bg-black/20 px-2 py-0.5 text-[10px] font-semibold tabnums text-muted">
          {bench.length}
        </span>
      </div>
      <div className="grid gap-1.5 p-2.5 lg:grid-cols-2">
        {bench.map((p) => (
          <button
            key={(p.id ?? p.name) + p.pos}
            type="button"
            onClick={() => onSelect(p)}
            className="group flex w-full items-center gap-2.5 rounded-lg border border-transparent bg-white/[0.018] px-2 py-2 text-left transition hover:border-line/70 hover:bg-white/[0.04] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent/70"
          >
            <span className="w-4 shrink-0 text-right text-[10px] font-semibold tabnums text-muted">
              {p.jersey}
            </span>
            <PlayerFace srcs={[p.headshot, p.img, p.photo]} jersey={p.jersey} size={32} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[11px] font-medium text-zinc-200 transition group-hover:text-accent sm:text-[12px]">
                  {p.name}
                </span>
                {p.subbedIn && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1"
                    title="Substituted on"
                  >
                    <span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-accent/15 text-[10px] font-bold leading-none text-accent ring-1 ring-accent/30">
                      ↑
                    </span>
                    {p.subMinute && (
                      <span className="text-[10px] tabnums text-muted">
                        {p.subMinute}
                      </span>
                    )}
                  </span>
                )}
                <PlayerMarkers p={p} />
              </span>
              <span className="mt-0.5 block text-[10px] uppercase tracking-[0.1em] text-muted">{posWord(p)}</span>
            </span>
            {p.rating !== undefined && (
              <span
                className="ml-auto shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold tabnums text-white"
                style={{ backgroundColor: ratingColor(p.rating) }}
              >
                {p.rating.toFixed(1)}
              </span>
            )}
            <span className="ml-0.5 text-[12px] text-muted/50 transition group-hover:translate-x-0.5 group-hover:text-accent">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
