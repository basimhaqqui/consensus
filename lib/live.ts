import { FIXTURES, type RatingSource } from "./data";
import {
  applyOverlay,
  type KnockoutEvent,
  type LiveOverlay,
  type MatchView,
} from "./compute";
import { buildUpperMatches, simulate, type SimRow } from "./bracket";
import { advanceFrom } from "./model";
import { fetchMarketOdds, type MarketOdds } from "./odds";

const ESPN =
  "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260628-20260720";

// ESPN abbreviation -> our internal team key (only where they differ)
const ALIAS: Record<string, string> = { CIV: "IVO" };
const toKey = (abbr: string) => ALIAS[abbr] ?? abbr;

type EspnCompetitor = {
  homeAway: "home" | "away";
  team: { abbreviation: string };
  score?: string;
  shootoutScore?: string;
  winner?: boolean;
};

function keySet(a: string, b: string) {
  return [a, b].sort().join("|");
}

// Parse the current match minute from ESPN status, for the in-play model.
function parseMinute(status: any): number | undefined {
  const name: string = status?.type?.name ?? "";
  if (/HALFTIME/.test(name)) return 45;
  const dc = String(status?.displayClock ?? "");
  const m = dc.match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (typeof status?.clock === "number") return Math.round(status.clock / 60);
  return undefined;
}

// Parse one ESPN event into a pair-keyed KnockoutEvent (overlay + schedule).
function parseEvent(e: any): KnockoutEvent | null {
  const comp = e.competitions?.[0];
  const cs: EspnCompetitor[] = comp?.competitors ?? [];
  if (cs.length !== 2) return null;
  const homeC = cs.find((c) => c.homeAway === "home");
  const awayC = cs.find((c) => c.homeAway === "away");
  if (!homeC || !awayC) return null;
  const homeKey = toKey(homeC.team.abbreviation);
  const awayKey = toKey(awayC.team.abbreviation);

  const st = e.status?.type ?? {};
  const state: string = st.state ?? "pre";
  const status: LiveOverlay["status"] =
    state === "post" ? "final" : state === "in" ? "live" : "scheduled";

  let winnerKey: string | undefined;
  if (status === "final") {
    if (homeC.winner) winnerKey = homeKey;
    else if (awayC.winner) winnerKey = awayKey;
  }

  const pens =
    homeC.shootoutScore !== undefined && awayC.shootoutScore !== undefined
      ? { home: Number(homeC.shootoutScore), away: Number(awayC.shootoutScore) }
      : undefined;

  const kickoffISO = e.date ?? "";
  const date = kickoffISO
    ? new Date(kickoffISO).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: "UTC",
      })
    : "TBD";

  return {
    homeKey,
    awayKey,
    espnId: e.id ? String(e.id) : undefined,
    kickoffISO,
    date,
    venue: comp?.venue?.address?.city ?? comp?.venue?.fullName ?? "TBD",
    overlay: {
      status,
      homeScore: homeC.score !== undefined ? Number(homeC.score) : undefined,
      awayScore: awayC.score !== undefined ? Number(awayC.score) : undefined,
      winnerKey,
      live:
        status === "scheduled"
          ? undefined
          : {
              detail: st.shortDetail ?? st.detail ?? "",
              clock: state === "in" ? e.status?.displayClock : undefined,
              minute: state === "in" ? parseMinute(e.status) : undefined,
              pens,
            },
    },
  };
}

// Fetch ESPN: overlays keyed by our static fixture ids, plus every knockout
// event keyed by team pair (feeds the dynamic upper-round matches).
async function fetchOverlays(): Promise<{
  overlays: Record<string, LiveOverlay>;
  events: Map<string, KnockoutEvent>;
}> {
  const res = await fetch(ESPN, {
    next: { revalidate: 20 }, // server-cache 20s; client polls more often
    headers: { "User-Agent": "wc26-consensus" },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = (await res.json()) as { events?: any[] };

  const events = new Map<string, KnockoutEvent>();
  for (const e of data.events ?? []) {
    const parsed = parseEvent(e);
    if (parsed) events.set(keySet(parsed.homeKey, parsed.awayKey), parsed);
  }

  // overlay the static R32 fixtures from the same pair index; the overlay is
  // reoriented if ESPN's home/away disagrees with our fixture's
  const overlays: Record<string, LiveOverlay> = {};
  for (const f of FIXTURES) {
    const ev = events.get(keySet(f.home, f.away));
    if (!ev) continue;
    const flipped = ev.homeKey !== f.home;
    overlays[f.id] = flipped
      ? {
          ...ev.overlay,
          homeScore: ev.overlay.awayScore,
          awayScore: ev.overlay.homeScore,
          live: ev.overlay.live && {
            ...ev.overlay.live,
            pens: ev.overlay.live.pens && {
              home: ev.overlay.live.pens.away,
              away: ev.overlay.live.pens.home,
            },
          },
        }
      : ev.overlay;
  }
  return { overlays, events };
}

// Attach live sportsbook probabilities to a match, reoriented to our
// home/away, with the market's advance odds derived through the same
// ET/pens machinery the model uses (apples-to-apples with m.advance).
function attachMarket(m: MatchView, odds: Map<string, MarketOdds>) {
  if (m.status === "final") return;
  const o = odds.get([m.homeKey, m.awayKey].sort().join("|"));
  if (!o) return;
  const flipped = o.homeKey !== m.homeKey;
  const pHome = flipped ? o.pAway : o.pHome;
  const pAway = flipped ? o.pHome : o.pAway;
  const adv = advanceFrom(
    pHome,
    o.pDraw,
    m.outcome.lambdaHome,
    m.outcome.lambdaAway
  );
  m.market = {
    pHome,
    pDraw: o.pDraw,
    pAway,
    advHome: adv.home,
    books: o.books,
  };
}

// R32 + every upper-round tie whose pairing is known, one match list.
function allMatches(
  overlays: Record<string, LiveOverlay>,
  events: Map<string, KnockoutEvent> | undefined,
  source: RatingSource = "model",
  odds?: Map<string, MarketOdds> | null
): MatchView[] {
  const r32 = applyOverlay(overlays, source);
  const all = [...r32, ...buildUpperMatches(r32, events, source)];
  if (odds) all.forEach((m) => attachMarket(m, odds));
  return all;
}

// Live matches (model view), with a safe fallback if ESPN is down.
export async function getLiveMatches(): Promise<{
  matches: MatchView[];
  live: boolean;
}> {
  try {
    const { overlays, events } = await fetchOverlays();
    return { matches: allMatches(overlays, events), live: true };
  } catch {
    return { matches: allMatches({}, undefined), live: false };
  }
}

export type Board = { matches: MatchView[]; sim: SimRow[] };

// All three rating views (consensus blend + our model + market) from a
// single live fetch.
export async function getBoards(): Promise<{
  live: boolean;
  blend: Board;
  model: Board;
  market: Board;
}> {
  let overlays: Record<string, LiveOverlay> = {};
  let events: Map<string, KnockoutEvent> | undefined;
  let live = false;
  const [espn, odds] = await Promise.all([
    fetchOverlays().catch(() => null),
    fetchMarketOdds(),
  ]);
  if (espn) {
    ({ overlays, events } = espn);
    live = true;
  }
  const build = (source: RatingSource): Board => {
    const matches = allMatches(overlays, events, source, odds);
    return { matches, sim: simulate(matches, 10000, source) };
  };
  return {
    live,
    blend: build("blend"),
    model: build("model"),
    market: build("market"),
  };
}
