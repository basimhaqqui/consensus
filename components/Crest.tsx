"use client";

import { useState } from "react";
import { crestUrl } from "@/lib/data";

export default function Crest({
  teamKey,
  src,
  code,
  size = 20,
  className = "",
}: {
  teamKey?: string;
  src?: string; // direct logo URL (clubs); overrides teamKey country crest
  code?: string;
  size?: number;
  className?: string;
}) {
  const [err, setErr] = useState(false);
  const label = (code ?? teamKey ?? "·").slice(0, 3);
  const url = src ?? (teamKey ? crestUrl(teamKey) : undefined);

  if (!url || err) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-sm bg-zinc-800 text-[10px] font-semibold text-muted ${className}`}
        style={{ width: size, height: size }}
      >
        {label}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={label}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setErr(true)}
      className={`object-contain ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
