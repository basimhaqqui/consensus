"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/wc", label: "Terminal" },
  { href: "/bracket", label: "Bracket" },
];

export default function Nav() {
  const path = usePathname();
  return (
    <nav className="flex items-center gap-1 text-[11px] uppercase tracking-wider">
      {LINKS.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`px-2.5 py-1 rounded transition-colors ${
              active
                ? "bg-accent/15 text-accent"
                : "text-muted hover:text-text hover:bg-panel2/60"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
