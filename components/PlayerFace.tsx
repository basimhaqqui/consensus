"use client";

import { useCallback, useEffect, useState } from "react";

// api-football photos come on a solid white studio background that looks like
// a sticker on the kit-coloured cards. Their CDN sends open CORS headers, so
// we knock the background out in a canvas: flood-fill near-white pixels from
// the top and side borders (never the bottom, so white shirts that touch the
// bottom edge survive) and cache the transparent PNG per photo.
const knockoutCache = new Map<string, string | null>();
const knockoutInflight = new Map<string, Promise<string | null>>();

const needsKnockout = (u: string) => u.includes("media.api-sports.io");

function whiteKnockout(src: string): Promise<string | null> {
  if (knockoutCache.has(src)) return Promise.resolve(knockoutCache.get(src)!);
  if (knockoutInflight.has(src)) return knockoutInflight.get(src)!;
  const p = new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const cv = document.createElement("canvas");
        cv.width = w;
        cv.height = h;
        const ctx = cv.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const im = ctx.getImageData(0, 0, w, h);
        const d = im.data;
        const white = (i: number) =>
          d[i] > 224 && d[i + 1] > 224 && d[i + 2] > 224;
        const seen = new Uint8Array(w * h);
        const queue: number[] = [];
        const push = (x: number, y: number) => {
          const idx = y * w + x;
          if (seen[idx]) return;
          seen[idx] = 1;
          if (white(idx * 4)) queue.push(idx);
        };
        // seed from the top edge and the upper 70% of the sides only
        for (let x = 0; x < w; x++) push(x, 0);
        for (let y = 0; y < Math.floor(h * 0.7); y++) {
          push(0, y);
          push(w - 1, y);
        }
        while (queue.length) {
          const idx = queue.pop()!;
          d[idx * 4 + 3] = 0; // transparent
          const x = idx % w;
          const y = (idx / w) | 0;
          if (x > 0) push(x - 1, y);
          if (x < w - 1) push(x + 1, y);
          if (y > 0) push(x, y - 1);
          if (y < h - 1) push(x, y + 1);
        }
        ctx.putImageData(im, 0, 0);
        resolve(cv.toDataURL("image/png"));
      } catch {
        resolve(null); // tainted canvas or draw failure — keep the raw photo
      }
    };
    img.onerror = () => resolve(null);
    img.src = src;
  }).then((v) => {
    knockoutCache.set(src, v);
    knockoutInflight.delete(src);
    return v;
  });
  knockoutInflight.set(src, p);
  return p;
}

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
  const raw = chain[idx];

  // swap in the background-knocked version of api-football photos once ready
  const [knocked, setKnocked] = useState<string | null>(null);
  useEffect(() => {
    setKnocked(null);
    if (raw && needsKnockout(raw)) {
      let alive = true;
      whiteKnockout(raw).then((v) => {
        if (alive && v) setKnocked(v);
      });
      return () => {
        alive = false;
      };
    }
  }, [raw]);
  const cur = raw && needsKnockout(raw) && knocked ? knocked : raw;

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

  const style = { width: "100%", height: "100%", ...crop(raw, shape) };
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
