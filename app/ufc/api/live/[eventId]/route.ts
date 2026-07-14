import { NextResponse } from "next/server";

// Fight-night live feed: ESPN bout status (round/clock/winner/method) + current de-vigged
// book prices. Upstream fetches are cached (ESPN 20s, odds 60s) so client polling doesn't
// hammer either source — odds cost 1 credit/min max while anyone is watching.

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");

const initSur = (s: string | null | undefined) => {
  const w = (s ?? "").replace(/\s+(jr\.?|sr\.?|ii|iii|iv)$/i, "").split(" ").filter(Boolean);
  return w.length < 2 ? norm(s) : norm(w[0]).slice(0, 1) + norm(w.slice(1).join(" "));
};

type LiveBout = {
  state: "pre" | "in" | "post";
  period: number | null;
  clock: string | null;
  winnerId: string | null;
  method: string | null;
  livePA: number | null; // de-vigged book average for competitor A, current
  books: number;
};

export async function GET(_req: Request, { params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  if (!/^\d+$/.test(eventId)) return NextResponse.json({ error: "bad event" }, { status: 400 });

  const sb = await fetch("https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard", {
    next: { revalidate: 20 },
  }).then((r) => (r.ok ? r.json() : null));

  const event = sb?.events?.find((e: { id: string }) => e.id === eventId);
  if (!event) return NextResponse.json({ bouts: {} }, { headers: { "cache-control": "public, max-age=30" } });

  // current book prices, matched by name pair (same loose rules as fetch-odds)
  const liveOdds = new Map<string, { pHome: number; books: number; home: string; away: string }>();
  const key = process.env.ODDS_API_KEY;
  if (key) {
    const odds = await fetch(
      `https://api.the-odds-api.com/v4/sports/mma_mixed_martial_arts/odds?apiKey=${key}&regions=us&markets=h2h&oddsFormat=decimal`,
      { next: { revalidate: 60 } }
    ).then((r) => (r.ok ? r.json() : []));
    for (const e of odds ?? []) {
      const probs: number[] = [];
      for (const bk of e.bookmakers ?? []) {
        const mkt = bk.markets?.find((m: { key: string }) => m.key === "h2h");
        if (!mkt || mkt.outcomes?.length !== 2) continue;
        const oH = mkt.outcomes.find((o: { name: string }) => norm(o.name) === norm(e.home_team));
        const oA = mkt.outcomes.find((o: { name: string }) => norm(o.name) !== norm(e.home_team));
        if (!oH || !oA || oH.price <= 1 || oA.price <= 1) continue;
        const [ih, ia] = [1 / oH.price, 1 / oA.price];
        probs.push(ih / (ih + ia));
      }
      if (!probs.length) continue;
      const entry = {
        pHome: probs.reduce((s, x) => s + x, 0) / probs.length,
        books: probs.length,
        home: e.home_team,
        away: e.away_team,
      };
      liveOdds.set([norm(e.home_team), norm(e.away_team)].sort().join("|"), entry);
      liveOdds.set([initSur(e.home_team), initSur(e.away_team)].sort().join("|"), entry);
    }
  }

  // Method lives only in the per-bout core status (scoreboard omits it). Fetch for
  // finished bouts; results are immutable once posted, so cache generously.
  const methodOf = async (boutId: string): Promise<string | null> => {
    try {
      const d = await fetch(
        `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${eventId}/competitions/${boutId}/status?lang=en&region=us`,
        { next: { revalidate: 120 } }
      ).then((r) => (r.ok ? r.json() : null));
      return d?.result?.shortDisplayName ?? d?.result?.displayName ?? null;
    } catch {
      return null;
    }
  };

  const bouts: Record<string, LiveBout> = {};
  for (const c of event.competitions ?? []) {
    const st = c.status ?? {};
    const comps = c.competitors ?? [];
    if (comps.length !== 2) continue;
    const nameOf = (x: { athlete?: { displayName?: string } }) => x.athlete?.displayName ?? null;
    const [a, b] = comps;

    let livePA: number | null = null;
    let books = 0;
    const m =
      liveOdds.get([norm(nameOf(a)), norm(nameOf(b))].sort().join("|")) ??
      liveOdds.get([initSur(nameOf(a)), initSur(nameOf(b))].sort().join("|"));
    if (m) {
      livePA = norm(m.home) === norm(nameOf(a)) || initSur(m.home) === initSur(nameOf(a)) ? m.pHome : 1 - m.pHome;
      livePA = Math.round(livePA * 1000) / 1000;
      books = m.books;
    }

    bouts[c.id] = {
      state: (st.type?.state as LiveBout["state"]) ?? "pre",
      period: st.period ?? null,
      clock: st.displayClock ?? null,
      winnerId: a.winner ? String(a.id) : b.winner ? String(b.id) : null,
      method: st.result?.shortDisplayName ?? st.result?.displayName ?? null,
      livePA,
      books,
    };
  }

  await Promise.all(
    Object.entries(bouts)
      .filter(([, b]) => b.state === "post" && b.winnerId && !b.method)
      .map(async ([id, b]) => {
        b.method = await methodOf(id);
      })
  );

  return NextResponse.json({ at: new Date().toISOString(), bouts }, { headers: { "cache-control": "public, max-age=15" } });
}
