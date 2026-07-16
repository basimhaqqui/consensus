"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWatchlist } from "./WatchlistProvider";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/signals", label: "Signals" },
  { href: "/wc", label: "World Cup" },
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
      className="primary-nav segmented-control flex min-w-0 items-center gap-0.5 overflow-x-auto p-0.5 text-[10px] uppercase tracking-[0.14em]"
    >
      {links.map((l) => {
        const active = isActivePath(path, l.href);
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
              <span className="ml-1.5 rounded-full border border-accent/25 bg-accent/10 px-1.5 py-0.5 text-[10px] tabnums text-accent">
                {items.length}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

function isActivePath(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/signals") {
    return path === "/signals" || path.startsWith("/signal/");
  }
  if (href === "/wc") {
    return (
      path === "/wc" ||
      path.startsWith("/match/") ||
      path.startsWith("/m/") ||
      path.startsWith("/league/") ||
      path === "/builder"
    );
  }
  if (href === "/ufc") return path === "/ufc" || path.startsWith("/ufc/");
  return path === href;
}
