"use client";

import { useEffect, useState, type ReactNode } from "react";

// Sticky tab bar over server-rendered sections. All panes stay mounted (hidden, not
// unmounted) so client state — picks, bet slips, open stats — survives tab switches.
// Hash integration: #<key> opens that tab; a hash matching anchorPrefix (e.g. #bout-…)
// opens anchorTab and then scrolls to the element (LiveNowBar jumps keep working).
export default function Tabs({
  tabs,
  anchorPrefix,
  anchorTab,
}: {
  tabs: { key: string; label: string; badge?: string; content: ReactNode }[];
  anchorPrefix?: string;
  anchorTab?: string;
}) {
  const [active, setActive] = useState(tabs[0]?.key);

  useEffect(() => {
    const apply = () => {
      const h = decodeURIComponent(window.location.hash);
      if (anchorPrefix && anchorTab && h.startsWith(anchorPrefix)) {
        setActive(anchorTab);
        requestAnimationFrame(() => {
          document.querySelector(h)?.scrollIntoView({
            behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
          });
        });
        return;
      }
      const key = h.slice(1);
      if (tabs.some((t) => t.key === key)) setActive(key);
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div className="sticky top-0 z-40 -mx-2 bg-bg/95 px-2 py-2.5">
        <div className="terminal-panel flex items-center gap-1 p-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActive(t.key);
                history.replaceState(null, "", `#${t.key}`);
              }}
              aria-pressed={active === t.key}
              aria-controls={`tab-panel-${t.key}`}
              className={`display min-h-10 flex-1 rounded-md border px-2 py-2 text-xs font-extrabold uppercase tracking-[0.08em] sm:px-3 sm:text-sm ${
                active === t.key
                  ? "border-accent/30 bg-accent/10 text-accent shadow-[inset_0_0_0_1px_rgba(239,68,68,0.04)]"
                  : "border-transparent text-muted hover:border-line hover:bg-white/[0.025] hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1.5 text-[10px] font-normal text-zinc-500 tabnums">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} id={`tab-panel-${t.key}`} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
