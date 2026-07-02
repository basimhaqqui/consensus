"use client";

import { useState } from "react";

// Pre-resolved face cutout, cropped/zoomed to the head so it reads as a
// headshot. Falls back to a jersey-number avatar when there's no image.
// shape "circle" is the classic avatar; "square" is a frameless cutout that
// fills its parent (used inside the FUT-style pitch cards).
export default function PlayerFace({
  src,
  jersey,
  size = 40,
  shape = "circle",
}: {
  src?: string | null;
  jersey?: string;
  size?: number;
  shape?: "circle" | "square";
}) {
  const [err, setErr] = useState(false);

  if (shape === "square") {
    if (!src || err) {
      return (
        <span className="flex h-full w-full items-center justify-center font-extrabold tabnums text-current text-lg">
          {jersey ?? "?"}
        </span>
      );
    }
    return (
      <span className="block h-full w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="eager"
          onError={() => setErr(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 8%", // head + shoulders, FUT style
            transform: "scale(1.45)",
            transformOrigin: "center 8%",
          }}
        />
      </span>
    );
  }

  if (!src || err) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-zinc-700 text-zinc-200 font-semibold tabnums border border-zinc-600"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {jersey ?? "?"}
      </span>
    );
  }

  return (
    <span
      className="inline-block rounded-full overflow-hidden border border-zinc-600 bg-zinc-800"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="eager"
        onError={() => setErr(true)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center 12%", // anchor on the face (top of the cutout)
          transform: "scale(1.9)",
          transformOrigin: "center 12%",
        }}
      />
    </span>
  );
}
