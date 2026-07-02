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
      <div className="rounded-xl border border-line bg-panel/60 overflow-hidden card-shadow">
        <div className="relative flex items-center justify-between gap-3 px-4 py-2.5 border-b border-line bg-panel2/60">
          <TeamTag sq={home} />
          {predicted ? (
            <span className="absolute left-1/2 -translate-x-1/2 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300 whitespace-nowrap">
              Predicted XI
            </span>
          ) : (
            status === "pre" && (
              <span className="absolute left-1/2 -translate-x-1/2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent whitespace-nowrap">
                Confirmed
              </span>
            )
          )}
          <TeamTag sq={away} align="right" />
        </div>
        <div className="p-2 sm:p-3">
          {/* vertical pitch on phones (FotMob style), horizontal on wider screens */}
          <div className="sm:hidden">
            <PitchDuo home={home} away={away} onSelect={select} orient="v" />
          </div>
          <div className="hidden sm:block">
            <PitchDuo home={home} away={away} onSelect={select} orient="h" />
          </div>
        </div>
        {predicted && (
          <div className="px-4 pb-3 text-center text-[10px] text-muted">
            Our projection from each side&apos;s last match — official lineups
            drop about an hour before kickoff.
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
      className={`flex items-center gap-2 min-w-0 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Crest teamKey={sq.key} src={sq.logo} code={sq.abbr} size={20} />
      {/* full name needs room — codes on phones */}
      <span className="hidden sm:inline text-sm font-semibold truncate">
        {sq.name}
      </span>
      <span className="sm:hidden text-sm font-semibold">{sq.abbr}</span>
      {sq.formation && (
        <span className="text-[11px] tabnums text-accent shrink-0">
          {sq.formation}
        </span>
      )}
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
    <div className="rounded-xl border border-line bg-panel/60 overflow-hidden card-shadow">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-line bg-panel2/60">
        <Crest teamKey={sq.key} src={sq.logo} code={sq.abbr} size={18} />
        <span className="text-sm font-semibold truncate">{sq.name}</span>
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted">
          Bench
        </span>
      </div>
      <div className="px-4 py-2 divide-y divide-line/40">
        {bench.map((p) => (
          <button
            key={(p.id ?? p.name) + p.pos}
            type="button"
            onClick={() => onSelect(p)}
            className="flex w-full items-center gap-2.5 py-1.5 text-left group"
          >
            <span className="w-4 shrink-0 text-right text-[10px] tabnums text-muted">
              {p.jersey}
            </span>
            <PlayerFace srcs={[p.headshot, p.photo, p.img]} jersey={p.jersey} size={28} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[12px] text-zinc-200 group-hover:text-accent">
                  {p.name}
                </span>
                {p.subbedIn && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1"
                    title="Substituted on"
                  >
                    <span className="inline-grid h-3.5 w-3.5 place-items-center rounded-full bg-accent/15 text-[9px] font-bold leading-none text-accent ring-1 ring-accent/30">
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
              <span className="block text-[10px] text-muted">{posWord(p)}</span>
            </span>
            {p.rating !== undefined && (
              <span
                className="ml-auto shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-bold tabnums text-white"
                style={{ backgroundColor: ratingColor(p.rating) }}
              >
                {p.rating.toFixed(1)}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
