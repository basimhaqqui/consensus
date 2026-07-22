"use client";

import Link from "next/link";
import { COMPETITIONS } from "@/lib/leagues";

const ITEMS = [
  { key: "football", href: "/football", label: "Desk" },
  ...COMPETITIONS.filter((competition) => competition.slug !== "fifa.world").map((competition) => ({
    key: competition.slug,
    href: `/league/${competition.slug}`,
    label: competition.short,
  })),
  { key: "fifa.world", href: "/wc", label: "WC26" },
  { key: "ufc", href: "/ufc", label: "UFC" },
];

export default function CompetitionNav({ active }: { active?: string }) {
  return (
    <nav
      aria-label="Competition navigation"
      className="primary-nav segmented-control flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 text-[10px] uppercase tracking-[0.14em]"
    >
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={isActive ? "page" : undefined}
            className={`shrink-0 rounded-[6px] px-2.5 py-1.5 transition-colors ${
              isActive
                ? "segmented-control__item--active"
                : "text-muted hover:bg-white/[0.035] hover:text-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
