"use client";

import { useState } from "react";

// Octagon-framed ESPN headshot with an initials fallback. The ref callback re-checks
// naturalWidth on mount because a 404 that completes before hydration never fires onError.
export default function FighterFace({
  id,
  name,
  size,
  tone = "neutral",
}: {
  id: string | null;
  name: string | null;
  size: number;
  tone?: "red" | "blue" | "neutral";
}) {
  const [broken, setBroken] = useState(false);
  const src = id ? `https://a.espncdn.com/i/headshots/mma/players/full/${id}.png` : null;
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  const ring =
    tone === "red"
      ? "bg-gradient-to-br from-red via-red/45 to-line shadow-[0_16px_44px_-22px_rgba(239,68,68,0.8)]"
      : tone === "blue"
        ? "bg-gradient-to-br from-blue via-blue/45 to-line shadow-[0_16px_44px_-22px_rgba(59,130,246,0.8)]"
        : "bg-gradient-to-br from-zinc-500/60 via-line to-zinc-800";

  return (
    <div className="relative isolate shrink-0" style={{ width: size, height: size }}>
      <div
        aria-hidden="true"
        className={`octagon absolute -inset-[5px] -z-10 opacity-20 ${ring}`}
      />
      <div className={`octagon h-full w-full ${ring} p-[2px]`}>
        <div className="octagon flex h-full w-full items-end justify-center overflow-hidden bg-panel2 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-24px_40px_-34px_rgba(0,0,0,0.9)]">
          {src && !broken ? (
            <img
              src={src}
              alt={name ?? ""}
              width={size}
              height={size}
              className="h-full w-full object-cover object-top"
              onError={() => setBroken(true)}
              ref={(el) => {
                if (el?.complete && el.naturalWidth === 0) setBroken(true);
              }}
            />
          ) : (
            <span
              className="display flex h-full w-full items-center justify-center font-bold text-muted"
              style={{ fontSize: size * 0.34 }}
            >
              {initials}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
