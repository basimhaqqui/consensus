// World Cup headlines from ESPN's public news feed — free, no key, and the
// same source we already trust for scores. Cached 15 minutes.

export type NewsItem = {
  headline: string;
  description?: string;
  href: string;
  published: string; // ISO
};

const NEWS_URL =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/news?limit=20";

export async function fetchNews(): Promise<NewsItem[]> {
  try {
    const res = await fetch(NEWS_URL, { next: { revalidate: 900 } });
    if (!res.ok) return [];
    const j = await res.json();
    const items: NewsItem[] = [];
    for (const a of j.articles ?? []) {
      const href = a.links?.web?.href;
      if (!a.headline || !href || !a.published) continue;
      items.push({
        headline: a.headline,
        description: a.description,
        href,
        published: a.published,
      });
    }
    return items;
  } catch {
    return [];
  }
}

// Headlines mentioning either team (by full name), newest first.
export function newsFor(items: NewsItem[], names: string[]): NewsItem[] {
  const needles = names.map((n) => n.toLowerCase());
  return items.filter((it) => {
    const hay = `${it.headline} ${it.description ?? ""}`.toLowerCase();
    return needles.some((n) => hay.includes(n));
  });
}

export function timeAgo(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  if (mins < 60) return `${mins}m`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.round(h / 24)}d`;
}
