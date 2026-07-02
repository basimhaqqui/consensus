import type { ReactNode } from "react";
import { FaFutbol } from "react-icons/fa";
import { GiRunningShoe } from "react-icons/gi";
import type { Player } from "@/lib/match";

const num = (v?: string) => {
  const n = parseInt(v ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
};

const DS = "drop-shadow(0 1px 1.5px rgba(0,0,0,0.8))";
const MAX = 4; // cap repeated icons so a big tally never overflows the chip

export function hasEvents(p: Player): boolean {
  return hasGoals(p) || hasAssists(p) || hasCards(p);
}

export const hasGoals = (p: Player) =>
  num(p.stats?.totalGoals) > 0 || num(p.stats?.ownGoals) > 0;
export const hasAssists = (p: Player) => num(p.stats?.goalAssists) > 0;
export const hasCards = (p: Player) =>
  num(p.stats?.yellowCards) > 0 || num(p.stats?.redCards) > 0;

// Soccer ball — Font Awesome's futbol icon (white, pattern shows through).
export function BallIcon({ muted = false }: { muted?: boolean }) {
  return (
    <FaFutbol
      className="h-full w-full"
      style={{ color: muted ? "#9aa3ad" : "#ffffff" }}
    />
  );
}

// Sports boot — Game Icons' running shoe, flipped to point left (assists).
function BootIcon() {
  return (
    <GiRunningShoe className="h-full w-full -scale-x-100" style={{ color: "#ffffff" }} />
  );
}

const times = (n: number, fn: (i: number) => ReactNode) =>
  Array.from({ length: Math.min(n, MAX) }, (_, i) => fn(i));

// Goals (+ own goals) — one ball per goal, lightly overlapping like FotMob.
export function Goals({ p, md }: { p: Player; md?: boolean }) {
  const g = num(p.stats?.totalGoals);
  const og = num(p.stats?.ownGoals);
  if (!g && !og) return null;
  const sz = md ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]";
  return (
    <span className="inline-flex items-center" style={{ filter: DS }}>
      {times(g, (i) => (
        <span key={`g${i}`} className={`${sz} ${i ? "-ml-2" : ""}`}>
          <BallIcon />
        </span>
      ))}
      {times(og, (i) => (
        <span key={`o${i}`} className={`${sz} ${g || i ? "-ml-2" : ""}`}>
          <BallIcon muted />
        </span>
      ))}
    </span>
  );
}

// Assists — one boot per assist.
export function Assists({ p, md }: { p: Player; md?: boolean }) {
  const a = num(p.stats?.goalAssists);
  if (!a) return null;
  const sz = md ? "h-[18px] w-[18px]" : "h-[15px] w-[15px]";
  return (
    <span className="inline-flex items-center" style={{ filter: DS }}>
      {times(a, (i) => (
        <span key={i} className={`${sz} ${i ? "-ml-2" : ""}`}>
          <BootIcon />
        </span>
      ))}
    </span>
  );
}

export function Cards({ p, md }: { p: Player; md?: boolean }) {
  const y = num(p.stats?.yellowCards);
  const r = num(p.stats?.redCards);
  if (!y && !r) return null;
  const card = md ? "h-[18px] w-3" : "h-[14px] w-[10px]";
  return (
    <span className="inline-flex items-center gap-0.5" style={{ filter: DS }}>
      {y > 0 && (
        <span className={`shrink-0 rounded-[2px] bg-[#facc15] ${card}`} title="Yellow card" />
      )}
      {r > 0 && (
        <span className={`shrink-0 rounded-[2px] bg-[#ef4444] ${card}`} title="Red card" />
      )}
    </span>
  );
}

// Combined inline row (used in the bench list and the player card).
export default function PlayerMarkers({
  p,
  size = "sm",
}: {
  p: Player;
  size?: "sm" | "md";
}) {
  if (!hasEvents(p)) return null;
  const md = size === "md";
  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Goals p={p} md={md} />
      <Assists p={p} md={md} />
      <Cards p={p} md={md} />
    </span>
  );
}
