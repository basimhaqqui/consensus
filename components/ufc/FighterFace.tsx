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
  const ring = tone === "red" ? "bg-red/35" : tone === "blue" ? "bg-blue/35" : "bg-line";

  return (
    <div className={`octagon shrink-0 ${ring} p-[2px]`} style={{ width: size, height: size }}>
      <div className="octagon flex h-full w-full items-end justify-center overflow-hidden bg-panel2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
            className="display font-bold text-muted flex h-full w-full items-center justify-center"
            style={{ fontSize: size * 0.34 }}
          >
            {initials}
          </span>
        )}
      </div>
    </div>
  );
}
