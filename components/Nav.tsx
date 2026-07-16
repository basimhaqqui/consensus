"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWatchlist } from "./WatchlistProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/signals", label: "Signals" },
  { href: "/wc", label: "Terminal" },
  { href: "/bracket", label: "Bracket" },
  { href: "/ufc", label: "UFC" },
  { href: "/watchlist", label: "Watchlist" },
];
const LINKS_WITHOUT_UFC = LINKS.filter((link) => link.href !== "/ufc");

export default function Nav({ hideUfc = false }: { hideUfc?: boolean }) {
  const path = usePathname();
  const { items, ready } = useWatchlist();
  const links = hideUfc ? LINKS_WITHOUT_UFC : LINKS;
  return (
    <nav
      aria-label="Primary navigation"
      className="segmented-control flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 text-[9px] uppercase tracking-[0.14em]"
    >
      {links.map((l) => {
        const active = path === l.href;
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={`shrink-0 rounded-[6px] px-3 py-1.5 transition-colors ${
              active
                ? "segmented-control__item--active"
                : "text-muted hover:bg-white/[0.035] hover:text-text"
            }`}
          >
            {l.label}
            {l.href === "/watchlist" && ready && items.length > 0 && (
              <span className="ml-1.5 rounded-full border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[7px] tabnums text-accent">
                {items.length}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
