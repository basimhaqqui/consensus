// Shared fight-night poller: one interval per event, every badge/banner subscribes.

export type LiveBout = {
  state: "pre" | "in" | "post";
  period: number | null;
  clock: string | null;
  winnerId: string | null;
  method: string | null;
  livePA: number | null;
  books: number;
};

const feeds = new Map<
  string,
  { data: Record<string, LiveBout>; listeners: Set<() => void>; timer?: ReturnType<typeof setInterval> }
>();

async function poll(eventId: string) {
  const feed = feeds.get(eventId);
  if (!feed) return;
  try {
    const res = await fetch(`/ufc/api/live/${eventId}`);
    if (!res.ok) return;
    const d = await res.json();
    feed.data = d.bouts ?? {};
    feed.listeners.forEach((l) => l());
  } catch {}
}

export function getBout(eventId: string, boutId: string): LiveBout | undefined {
  return feeds.get(eventId)?.data[boutId];
}

export function subscribe(eventId: string, onChange: () => void) {
  let feed = feeds.get(eventId);
  if (!feed) {
    feed = { data: {}, listeners: new Set() };
    feeds.set(eventId, feed);
  }
  feed.listeners.add(onChange);
  if (!feed.timer) {
    poll(eventId);
    feed.timer = setInterval(() => poll(eventId), 30000);
  }
  return () => {
    feed!.listeners.delete(onChange);
    if (!feed!.listeners.size && feed!.timer) {
      clearInterval(feed!.timer);
      feed!.timer = undefined;
    }
  };
}

// Poll only around fight time: 3h before to 12h after.
export function inLiveWindow(fightDate: string) {
  const start = new Date(fightDate).getTime();
  const now = Date.now();
  return now >= start - 3 * 3600e3 && now <= start + 12 * 3600e3;
}
