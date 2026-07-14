"use client";

import Link from "next/link";
import { COMPETITIONS } from "@/lib/leagues";

export default function CompetitionNav({ active }: { active?: string }) {
  return (
    <nav
      aria-label="Competition navigation"
      className="segmented-control flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 text-[9px] uppercase tracking-[0.14em]"
    >
      {COMPETITIONS.map((c) => {
        const href = c.slug === "fifa.world" ? "/wc" : `/league/${c.slug}`;
        const isActive = c.slug === active;
        return (
          <Link
            key={c.slug}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-[6px] px-2.5 py-1.5 transition-colors ${
              isActive
                ? "bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(52,211,153,0.16)]"
                : "text-muted hover:bg-white/[0.035] hover:text-text"
            }`}
          >
            {c.short}
          </Link>
        );
      })}
    </nav>
  );
}
