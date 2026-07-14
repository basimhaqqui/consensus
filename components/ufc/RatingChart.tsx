"use client";

import { useRef, useState } from "react";

// Rating-history line: single series, recessive 1500 baseline, endpoint label,
// and a crosshair tooltip on hover or keyboard focus.
export default function RatingChart({ points }: { points: [number, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (points.length < 2) return null;

  const W = 640;
  const H = 200;
  const PAD = { l: 42, r: 28, t: 26, b: 34 };
  const days = points.map((p) => p[0]);
  const ratings = points.map((p) => p[1]);
  const x0 = Math.min(...days);
  const x1 = Math.max(...days);
  const lo = Math.min(1470, ...ratings) - 20;
  const hi = Math.max(1530, ...ratings) + 20;
  const X = (d: number) => PAD.l + ((d - x0) / (x1 - x0 || 1)) * (W - PAD.l - PAD.r);
  const Y = (r: number) => PAD.t + (1 - (r - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const path = points.map(([d, r], i) => `${i ? "L" : "M"}${X(d).toFixed(1)},${Y(r).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  const hovered = hover !== null ? points[hover] : null;
  const fmt = (day: number) =>
    new Date(day * 864e5).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  const yTicks = [hi, Math.round((hi + lo) / 2), lo];

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      role="img"
      aria-label={`Elo rating history from ${fmt(x0)} to ${fmt(x1)}`}
      tabIndex={0}
      onFocus={() => setHover(points.length - 1)}
      onBlur={() => setHover(null)}
      onMouseLeave={() => setHover(null)}
      onMouseMove={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        if (!rect) return;
        const px = ((e.clientX - rect.left) / rect.width) * W;
        let best = 0;
        for (let i = 1; i < points.length; i++) {
          if (Math.abs(X(points[i][0]) - px) < Math.abs(X(points[best][0]) - px)) best = i;
        }
        setHover(best);
      }}
    >
      <title>Elo rating history</title>
      <defs>
        <linearGradient id="rating-line" x1="0" x2="1">
          <stop offset="0" stopColor="var(--blue-corner)" />
          <stop offset="0.58" stopColor="var(--red-corner)" />
          <stop offset="1" stopColor="var(--red-corner)" />
        </linearGradient>
      </defs>
      {yTicks.map((tick) => (
        <g key={tick}>
          <line
            x1={PAD.l}
            x2={W - PAD.r}
            y1={Y(tick)}
            y2={Y(tick)}
            stroke="var(--hairline)"
            strokeWidth="1"
          />
          <text x={PAD.l - 8} y={Y(tick) + 3} fontSize="9" fill="var(--muted)" textAnchor="end">
            {tick}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={W - PAD.r} y1={Y(1500)} y2={Y(1500)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
      <text x={W - PAD.r - 4} y={Y(1500) - 5} fontSize="9" fill="var(--muted)" textAnchor="end">
        BASE 1500
      </text>
      <path d={path} fill="none" stroke="url(#rating-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={X(last[0])} cy={Y(last[1])} r="3.5" fill="var(--red-corner)" />
      {!hovered && (
        <text x={X(last[0]) + 8} y={Y(last[1]) + 4} fontSize="12" fill="var(--text)" fontWeight="700">
          {last[1]}
        </text>
      )}
      {hovered && (
        <g>
          <line x1={X(hovered[0])} x2={X(hovered[0])} y1={PAD.t} y2={H - PAD.b} stroke="var(--hairline-strong)" strokeWidth="1" />
          <circle cx={X(hovered[0])} cy={Y(hovered[1])} r="4" fill="var(--red-corner)" stroke="var(--panel)" strokeWidth="2" />
          <text
            x={Math.min(Math.max(X(hovered[0]), 50), W - 90)}
            y={PAD.t + 2}
            fontSize="11"
            fill="var(--text)"
            textAnchor="middle"
          >
            {hovered[1]} · {fmt(hovered[0])}
          </text>
        </g>
      )}
      <text x={PAD.l} y={H - 8} fontSize="9" fill="var(--muted)">
        {fmt(x0)}
      </text>
      <text x={W - PAD.r} y={H - 8} fontSize="9" fill="var(--muted)" textAnchor="end">
        {fmt(x1)}
      </text>
      <text x={PAD.l} y={10} fontSize="8" fill="var(--muted)" letterSpacing="1.4">
        ELO RATING
      </text>
      <text x={(PAD.l + W - PAD.r) / 2} y={H - 8} fontSize="8" fill="var(--muted)" textAnchor="middle" letterSpacing="1.2">
        FIGHT DATE
      </text>
    </svg>
  );
}
