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
          document.querySelector(h)?.scrollIntoView({ behavior: "smooth" });
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
      <div className="sticky top-0 z-40 -mx-4 bg-bg/90 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-1 rounded-xl border border-line bg-panel/80 p-1">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setActive(t.key);
                history.replaceState(null, "", `#${t.key}`);
              }}
              className={`display flex-1 rounded-lg px-3 py-1.5 text-sm font-extrabold uppercase tracking-wide ${
                active === t.key ? "bg-accent/20 text-accent" : "text-muted hover:text-zinc-300"
              }`}
            >
              {t.label}
              {t.badge && <span className="ml-1.5 text-[10px] font-normal text-zinc-500 tabnums">{t.badge}</span>}
            </button>
          ))}
        </div>
      </div>
      {tabs.map((t) => (
        <div key={t.key} hidden={active !== t.key}>
          {t.content}
        </div>
      ))}
    </div>
  );
}
