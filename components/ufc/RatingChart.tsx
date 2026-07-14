"use client";

import { useRef, useState } from "react";

// Rating-history line: single series (no legend — the section title names it), 2px line,
// recessive 1500 baseline, endpoint dot + value label, crosshair tooltip on hover.
export default function RatingChart({ points }: { points: [number, number][] }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  if (points.length < 2) return null;

  const W = 640;
  const H = 140;
  const PAD = { l: 8, r: 56, t: 12, b: 16 };
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

  return (
    <svg
      ref={ref}
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label="Rating history"
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
      <line x1={PAD.l} x2={W - PAD.r} y1={Y(1500)} y2={Y(1500)} stroke="#23232e" strokeWidth="1" strokeDasharray="3 4" />
      <text x={W - PAD.r + 6} y={Y(1500) + 3} fontSize="10" fill="#5b5866">
        1500
      </text>
      <path d={path} fill="none" stroke="#e21d1d" strokeWidth="2" strokeLinejoin="round" />
      <circle cx={X(last[0])} cy={Y(last[1])} r="3.5" fill="#e21d1d" />
      {!hovered && (
        <text x={X(last[0]) + 8} y={Y(last[1]) + 4} fontSize="12" fill="#eceaf0" fontWeight="700">
          {last[1]}
        </text>
      )}
      {hovered && (
        <g>
          <line x1={X(hovered[0])} x2={X(hovered[0])} y1={PAD.t} y2={H - PAD.b} stroke="#3a3a46" strokeWidth="1" />
          <circle cx={X(hovered[0])} cy={Y(hovered[1])} r="4" fill="#e21d1d" stroke="#0e0e13" strokeWidth="2" />
          <text
            x={Math.min(Math.max(X(hovered[0]), 50), W - 90)}
            y={PAD.t + 2}
            fontSize="11"
            fill="#eceaf0"
            textAnchor="middle"
          >
            {hovered[1]} · {fmt(hovered[0])}
          </text>
        </g>
      )}
    </svg>
  );
}
