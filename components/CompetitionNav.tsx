"use client";

import Link from "next/link";
import { COMPETITIONS } from "@/lib/leagues";

export default function CompetitionNav({ active }: { active?: string }) {
  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-[11px] uppercase tracking-wider">
      {COMPETITIONS.map((c) => {
        const href = c.slug === "fifa.world" ? "/wc" : `/league/${c.slug}`;
        const isActive = c.slug === active;
        return (
          <Link
            key={c.slug}
            href={href}
            className={`shrink-0 px-2.5 py-1 rounded transition-colors ${
              isActive
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-text hover:bg-panel2/60"
            }`}
          >
            {c.short}
          </Link>
        );
      })}
    </nav>
  );
}
