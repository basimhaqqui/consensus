import type { WinProbPoint } from "@/lib/model";
import type { MatchEvent } from "@/lib/match";

// Win-probability timeline: the in-play model replayed across the match.
// Stacked areas use the same encoding as every W/D/W bar on the site —
// home (accent green) rises from the bottom, away (sky) hangs from the top,
// the draw band is the grey gap between them. Goals and red cards are marked.

const W = 600;
const H = 150;
const PAD_X = 4;
const PAD_TOP = 14; // room for event markers
const PAD_BOT = 16; // room for the axis labels

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
  if (series.length < 2) return null;

  const x = (m: number) => PAD_X + (m / 90) * (W - 2 * PAD_X);
  const plotH = H - PAD_TOP - PAD_BOT;
  // y for a probability measured from the BOTTOM of the plot
  const yUp = (p: number) => PAD_TOP + plotH - p * plotH;
  // y measured from the TOP of the plot
  const yDown = (p: number) => PAD_TOP + p * plotH;

  const lastM = series[series.length - 1].m;

  // home band: bottom edge -> pHome boundary
  const homePath =
    `M ${x(0)} ${yUp(0)} ` +
    series.map((pt) => `L ${x(pt.m)} ${yUp(pt.pHome)}`).join(" ") +
    ` L ${x(lastM)} ${yUp(0)} Z`;
  // away band: top edge -> pAway boundary
  const awayPath =
    `M ${x(0)} ${yDown(0)} ` +
    series.map((pt) => `L ${x(pt.m)} ${yDown(pt.pAway)}`).join(" ") +
    ` L ${x(lastM)} ${yDown(0)} Z`;

  const markers = events.filter(
    (e) =>
      (e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal" || e.type === "red") &&
      Math.min(Math.floor(e.sortMin), 90) <= lastM
  );

  const cur = series[series.length - 1];

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider text-muted">
        <span className="text-accent">
          {homeCode} {Math.round(cur.pHome * 100)}%
        </span>
        <span>
          {live ? "in-play odds · updating live" : "how the odds moved"} · D{" "}
          {Math.round(cur.pDraw * 100)}%
        </span>
        <span className="text-sky-400">
          {Math.round(cur.pAway * 100)}% {awayCode}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded-lg border border-line bg-panel2/40"
        role="img"
        aria-label="Win probability over the match"
      >
        {/* draw band = background */}
        <rect
          x={PAD_X}
          y={PAD_TOP}
          width={W - 2 * PAD_X}
          height={plotH}
          fill="#3f3f46"
          opacity="0.35"
        />
        <path d={homePath} fill="#34d399" opacity="0.75" />
        <path d={awayPath} fill="#38bdf8" opacity="0.65" />

        {/* halftime + axis ticks */}
        {[0, 45, 90].map((m) => (
          <g key={m}>
            <line
              x1={x(m)}
              x2={x(m)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotH}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1"
              strokeDasharray={m === 45 ? "3 3" : undefined}
            />
            <text
              x={x(m)}
              y={H - 4}
              textAnchor={m === 0 ? "start" : m === 90 ? "end" : "middle"}
              fontSize="9"
              fill="rgba(255,255,255,0.45)"
            >
              {m === 0 ? "KO" : m === 45 ? "HT" : "FT"}
            </text>
          </g>
        ))}

        {/* live frontier */}
        {live && (
          <line
            x1={x(lastM)}
            x2={x(lastM)}
            y1={PAD_TOP}
            y2={PAD_TOP + plotH}
            stroke="#34d399"
            strokeWidth="1.5"
          />
        )}

        {/* event markers along the top */}
        {markers.map((e, i) => {
          const mx = x(Math.min(Math.floor(e.sortMin), 90));
          const isRed = e.type === "red";
          const homeSide = e.side === "home";
          return (
            <g key={i}>
              <line
                x1={mx}
                x2={mx}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                stroke={isRed ? "#ef4444" : "rgba(255,255,255,0.35)"}
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              {isRed ? (
                <rect x={mx - 3} y={3} width="6" height="8" rx="1" fill="#ef4444" />
              ) : (
                <circle
                  cx={mx}
                  cy={7}
                  r="4.5"
                  fill={homeSide ? "#34d399" : "#38bdf8"}
                  stroke="#0a0f0d"
                  strokeWidth="1"
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
