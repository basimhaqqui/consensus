import { timeAgo, type NewsItem } from "@/lib/news";

// Compact headline list — text rows only, links out. Renders nothing when
// the feed is empty so the page never shows a hollow section.
export default function NewsPanel({
  items,
  title = "Headlines",
  limit = 6,
}: {
  items: NewsItem[];
  title?: string;
  limit?: number;
}) {
  if (!items.length) return null;
  return (
    <section className="mt-10">
      <div className="section-heading" data-index="05">
        <h2>
          {title}
        </h2>
      </div>
      <ul className="terminal-panel divide-y divide-[var(--hairline)]">
        {items.slice(0, limit).map((it) => (
          <li key={it.href}>
            <a
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025]"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
                {it.headline}
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted">
                {timeAgo(it.published)}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
