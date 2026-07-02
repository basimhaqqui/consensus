"use client";

import { useCallback, useState } from "react";

// Player avatar with a fallback chain: ESPN id-keyed headshot (identity-safe,
// current-season) -> TheSportsDB cutout (name-matched) -> jersey-number badge.
// Each candidate that 404s advances the chain client-side.
// shape "circle" is the classic avatar; "square" is a frameless cutout that
// fills its parent (used inside the FUT-style pitch cards).

// ESPN headshots are already head-and-shoulders crops; TheSportsDB cutouts
// are full-body renders that need an aggressive zoom to read as a headshot.
const isHeadshot = (u: string) =>
  u.includes("/i/headshots/") || u.includes("media.api-sports.io");

function crop(u: string, shape: "circle" | "square") {
  if (isHeadshot(u)) {
    return {
      objectFit: "cover" as const,
      objectPosition: "center top",
      transform: shape === "square" ? "scale(1.1)" : "scale(1.25)",
      transformOrigin: "center 20%",
    };
  }
  return shape === "square"
    ? {
        objectFit: "cover" as const,
        objectPosition: "center 8%", // head + shoulders, FUT style
        transform: "scale(1.45)",
        transformOrigin: "center 8%",
      }
    : {
        objectFit: "cover" as const,
        objectPosition: "center 12%", // anchor on the face (top of the cutout)
        transform: "scale(1.9)",
        transformOrigin: "center 12%",
      };
}

export default function PlayerFace({
  src,
  srcs,
  jersey,
  size = 40,
  shape = "circle",
}: {
  src?: string | null;
  srcs?: (string | null | undefined)[]; // fallback chain, tried in order
  jersey?: string;
  size?: number;
  shape?: "circle" | "square";
}) {
  const chain = (srcs ?? [src]).filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const cur = chain[idx];

  // Server-rendered imgs can finish 404ing before hydration, so onError never
  // fires — catch already-failed images on mount and advance the chain.
  const checkFailed = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth === 0) setIdx((i) => i + 1);
  }, []);

  if (!cur) {
    return shape === "square" ? (
      <span className="flex h-full w-full items-center justify-center font-extrabold tabnums text-current text-lg">
        {jersey ?? "?"}
      </span>
    ) : (
      <span
        className="inline-flex items-center justify-center rounded-full bg-zinc-700 text-zinc-200 font-semibold tabnums border border-zinc-600"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {jersey ?? "?"}
      </span>
    );
  }

  const style = { width: "100%", height: "100%", ...crop(cur, shape) };
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={cur} // reset error state per candidate
      ref={checkFailed}
      src={cur}
      alt=""
      loading="eager"
      onError={() => setIdx((i) => i + 1)}
      style={style}
    />
  );

  if (shape === "square") {
    return <span className="block h-full w-full overflow-hidden">{img}</span>;
  }
  return (
    <span
      className="inline-block rounded-full overflow-hidden border border-zinc-600 bg-zinc-800"
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
