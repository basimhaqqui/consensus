"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// Re-runs the server component (which re-fetches live results and re-runs the
// Monte-Carlo simulation) on an interval, so the title race / bracket odds stay
// current without a manual reload. Shows a live "updated Ns ago" indicator.
export default function AutoRefresh({
  updatedAt,
  intervalMs = 30_000,
  label = "Simulating live",
}: {
  updatedAt: number;
  intervalMs?: number;
  label?: string;
}) {
  const router = useRouter();
  const [now, setNow] = useState(updatedAt);

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const refresh = setInterval(() => router.refresh(), intervalMs);
    return () => {
      clearInterval(tick);
      clearInterval(refresh);
    };
  }, [intervalMs, router]);

  const ago = Math.max(0, Math.round((now - updatedAt) / 1000));

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/70" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
      </span>
      <span className="uppercase tracking-wider text-accent">{label}</span>
      <span className="text-zinc-600">·</span>
      <span className="tabnums">updated {ago}s ago</span>
    </span>
  );
}
