import { FIXTURES } from "./data";
import { applyOverlay, type LiveOverlay, type MatchView } from "./compute";
import { simulate, type SimRow } from "./bracket";

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

// Fetch ESPN and produce overlays keyed by our fixture id.
async function fetchOverlays(): Promise<Record<string, LiveOverlay>> {
  const res = await fetch(ESPN, {
    next: { revalidate: 20 }, // server-cache 20s; client polls more often
    headers: { "User-Agent": "wc26-consensus" },
  });
  if (!res.ok) throw new Error(`ESPN ${res.status}`);
  const data = (await res.json()) as { events?: any[] };

  // index ESPN events by the unordered pair of team keys
  const byPair = new Map<string, any>();
  for (const e of data.events ?? []) {
    const comp = e.competitions?.[0];
    const cs: EspnCompetitor[] = comp?.competitors ?? [];
    if (cs.length !== 2) continue;
    const k1 = toKey(cs[0].team.abbreviation);
    const k2 = toKey(cs[1].team.abbreviation);
    byPair.set(keySet(k1, k2), e);
  }

  const overlays: Record<string, LiveOverlay> = {};
  for (const f of FIXTURES) {
    const e = byPair.get(keySet(f.home, f.away));
    if (!e) continue;
    const cs: EspnCompetitor[] = e.competitions[0].competitors;
    const find = (key: string) =>
      cs.find((c) => toKey(c.team.abbreviation) === key);
    const homeC = find(f.home);
    const awayC = find(f.away);
    if (!homeC || !awayC) continue;

    const st = e.status?.type ?? {};
    const state: string = st.state ?? "pre";
    const status: LiveOverlay["status"] =
      state === "post" ? "final" : state === "in" ? "live" : "scheduled";

    const homeScore = homeC.score !== undefined ? Number(homeC.score) : undefined;
    const awayScore = awayC.score !== undefined ? Number(awayC.score) : undefined;

    let winnerKey: string | undefined;
    if (status === "final") {
      if (homeC.winner) winnerKey = f.home;
      else if (awayC.winner) winnerKey = f.away;
    }

    const pens =
      homeC.shootoutScore !== undefined && awayC.shootoutScore !== undefined
        ? { home: Number(homeC.shootoutScore), away: Number(awayC.shootoutScore) }
        : undefined;

    overlays[f.id] = {
      status,
      homeScore,
      awayScore,
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
    };
  }
  return overlays;
}

// Live matches (model view), with a safe fallback if ESPN is down.
export async function getLiveMatches(): Promise<{
  matches: MatchView[];
  live: boolean;
}> {
  try {
    const overlays = await fetchOverlays();
    return { matches: applyOverlay(overlays), live: true };
  } catch {
    const { getMatches } = await import("./compute");
    return { matches: getMatches(), live: false };
  }
}

export type Board = { matches: MatchView[]; sim: SimRow[] };

// Both rating views (our model + market) from a single live fetch.
export async function getBoards(): Promise<{
  live: boolean;
  model: Board;
  market: Board;
}> {
  let overlays: Record<string, LiveOverlay> = {};
  let live = false;
  try {
    overlays = await fetchOverlays();
    live = true;
  } catch {
    /* fall back to static fixtures */
  }
  const build = (source: "model" | "market"): Board => {
    const matches = applyOverlay(overlays, source);
    return { matches, sim: simulate(matches, 10000, source) };
  };
  return { live, model: build("model"), market: build("market") };
}
