"use client";

import { useMemo, useRef, useState } from "react";
import type { WinProbPoint } from "@/lib/model";
import type { MatchEvent } from "@/lib/match";

// Win-probability timeline. Two 2px series lines (home = accent, away = sky)
// over ~10%-opacity washes, hairline gridlines, goal/red markers sitting ON
// the affected team's line, and a crosshair tooltip. Steps stay sharp — odds
// really do jump at a goal; smoothing would misrepresent the model.

const W = 600;
const H = 168;
const PAD_L = 8;
const PAD_R = 8;
const PAD_T = 10;
const PAD_B = 18;

const HOME = "#34d399";
const AWAY = "#38bdf8";
const SURFACE = "#101613";

const isGoal = (t: MatchEvent["type"]) =>
  t === "goal" || t === "pen-goal" || t === "own-goal";

export default function WinProbChart({
  series,
  events,
  homeCode,
  awayCode,
  live,
}: {
  series: WinProbPoint[];
  events: MatchEvent[];
  homeCode: string;
  awayCode: string;
  live?: boolean;
}) {
  const ref = useRef<SVGSVGElement>(null);
  const [hoverM, setHoverM] = useState<number | null>(null);

  const lastM = series[series.length - 1]?.m ?? 0;
  const x = (m: number) => PAD_L + (m / 90) * (W - PAD_L - PAD_R);
  const plotH = H - PAD_T - PAD_B;
  const y = (p: number) => PAD_T + (1 - p) * plotH;

  const byMinute = useMemo(() => {
    const map = new Map<number, WinProbPoint>();
    series.forEach((pt) => map.set(pt.m, pt));
    return map;
  }, [series]);

  if (series.length < 2) return null;

  const line = (pick: (pt: WinProbPoint) => number) =>
    series.map((pt, i) => `${i ? "L" : "M"} ${x(pt.m)} ${y(pick(pt))}`).join(" ");
  const wash = (pick: (pt: WinProbPoint) => number) =>
    `${line(pick)} L ${x(lastM)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  const markers = events.filter(
    (e) =>
      (isGoal(e.type) || e.type === "red") &&
      Math.min(Math.floor(e.sortMin), 90) <= lastM
  );

  const cur = hoverM !== null ? byMinute.get(hoverM) : undefined;
  const shown = cur ?? series[series.length - 1];
  const shownM = cur ? hoverM! : lastM;
  const scoreAt = (m: number) => {
    let h = 0;
    let a = 0;
    for (const e of events) {
      if (!isGoal(e.type) || Math.min(Math.floor(e.sortMin), 90) > m) continue;
      if (e.side === "home") h++;
      else a++;
    }
    return `${h}–${a}`;
  };

  const onMove = (evt: React.PointerEvent<SVGSVGElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const fx = ((evt.clientX - rect.left) / rect.width) * W;
    const m = Math.round(((fx - PAD_L) / (W - PAD_L - PAD_R)) * 90);
    setHoverM(Math.max(0, Math.min(lastM, m)));
  };

  return (
    <div>
      {/* legend + readout — identity from swatches, values in text ink */}
      <div className="mb-1.5 flex items-center justify-between text-[10px] tabnums">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="h-[3px] w-4 rounded-full" style={{ background: HOME }} />
            {homeCode} {Math.round(shown.pHome * 100)}%
          </span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="h-[3px] w-4 rounded-full" style={{ background: AWAY }} />
            {awayCode} {Math.round(shown.pAway * 100)}%
          </span>
          <span className="text-muted">Draw {Math.round(shown.pDraw * 100)}%</span>
        </span>
        <span className="text-muted uppercase tracking-wider">
          {hoverM !== null
            ? `${shownM}' · ${scoreAt(shownM)}`
            : live
            ? "live · win probability"
            : "win probability"}
        </span>
      </div>

      <svg
        ref={ref}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full cursor-crosshair rounded-lg border border-line bg-panel2/40"
        role="img"
        aria-label="Win probability over the match"
        onPointerMove={onMove}
        onPointerLeave={() => setHoverM(null)}
      >
        {/* recessive hairline grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => (
          <line
            key={p}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={y(p)}
            y2={y(p)}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        ))}
        <line
          x1={x(45)}
          x2={x(45)}
          y1={PAD_T}
          y2={PAD_T + plotH}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />

        {/* washes, then lines */}
        <path d={wash((pt) => pt.pHome)} fill={HOME} opacity="0.1" />
        <path d={wash((pt) => pt.pAway)} fill={AWAY} opacity="0.1" />
        <path
          d={line((pt) => pt.pHome)}
          fill="none"
          stroke={HOME}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={line((pt) => pt.pAway)}
          fill="none"
          stroke={AWAY}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* crosshair */}
        {hoverM !== null && (
          <line
            x1={x(hoverM)}
            x2={x(hoverM)}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke="rgba(255,255,255,0.25)"
            strokeWidth="1"
          />
        )}

        {/* live frontier */}
        {live && hoverM === null && (
          <line
            x1={x(lastM)}
            x2={x(lastM)}
            y1={PAD_T}
            y2={PAD_T + plotH}
            stroke={HOME}
            strokeWidth="1"
            opacity="0.5"
          />
        )}

        {/* event markers on the affected team's line, surface-ringed */}
        {markers.map((e, i) => {
          const m = Math.min(Math.floor(e.sortMin), 90);
          const pt = byMinute.get(Math.min(m, lastM));
          if (!pt) return null;
          const onHome = e.side === "home";
          const cy = y(onHome ? pt.pHome : pt.pAway);
          if (e.type === "red") {
            return (
              <rect
                key={i}
                x={x(m) - 3.5}
                y={cy - 5}
                width="7"
                height="10"
                rx="1.5"
                fill="#ef4444"
                stroke={SURFACE}
                strokeWidth="2"
              />
            );
          }
          return (
            <circle
              key={i}
              cx={x(m)}
              cy={cy}
              r="4.5"
              fill={onHome ? HOME : AWAY}
              stroke={SURFACE}
              strokeWidth="2"
            />
          );
        })}

        {/* hover dots on both lines */}
        {cur && (
          <>
            <circle cx={x(shownM)} cy={y(cur.pHome)} r="4" fill={HOME} stroke={SURFACE} strokeWidth="2" />
            <circle cx={x(shownM)} cy={y(cur.pAway)} r="4" fill={AWAY} stroke={SURFACE} strokeWidth="2" />
          </>
        )}

        {/* axis */}
        {(
          [
            [0, "KO", "start"],
            [45, "HT", "middle"],
            [90, "FT", "end"],
          ] as const
        ).map(([m, label, anchor]) => (
          <text
            key={label}
            x={x(m)}
            y={H - 5}
            textAnchor={anchor}
            fontSize="9"
            fill="rgba(255,255,255,0.4)"
          >
            {label}
          </text>
        ))}
        <text x={W - PAD_R} y={y(1) + 9} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)">
          100%
        </text>
        <text x={W - PAD_R} y={y(0) - 3} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.3)">
          0%
        </text>
      </svg>
    </div>
  );
}
