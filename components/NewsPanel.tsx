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
      <div className="mb-3 flex items-center gap-3">
        <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
          {title}
        </h2>
        <div className="h-px flex-1 bg-line" />
      </div>
      <ul className="divide-y divide-line rounded-xl border border-line bg-panel card-shadow">
        {items.slice(0, limit).map((it) => (
          <li key={it.href}>
            <a
              href={it.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-baseline gap-3 px-4 py-2.5 hover:bg-panel2 transition-colors"
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
