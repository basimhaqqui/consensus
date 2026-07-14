"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/wc", label: "Terminal" },
  { href: "/bracket", label: "Bracket" },
  { href: "/ufc", label: "UFC" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Primary navigation"
      className="segmented-control flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 text-[9px] uppercase tracking-[0.14em]"
    >
      {LINKS.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-[6px] px-3 py-1.5 transition-colors ${
              active
                ? "bg-accent/12 text-accent shadow-[inset_0_0_0_1px_rgba(52,211,153,0.16)]"
                : "text-muted hover:bg-white/[0.035] hover:text-text"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
