// Live sportsbook odds via The Odds API (the-odds-api.com, free tier).
// Fetches 3-way (h2h, 90-minute) moneylines for the World Cup, strips the
// vig, and averages implied probabilities across books. Keyed by unordered
// team pair, same as the ESPN knockout events.
//
// Needs ODDS_API_KEY in the environment; everything degrades gracefully
// without it (the value column simply doesn't render).

import { TEAMS } from "./data";

const SPORT = process.env.ODDS_SPORT_KEY ?? "soccer_fifa_world_cup";
const KEY = process.env.ODDS_API_KEY;

export type MarketOdds = {
  homeKey: string;
  awayKey: string;
  pHome: number; // de-vigged 90' probabilities, averaged across books
  pDraw: number;
  pAway: number;
  books: number; // how many bookmakers were averaged
};

// API team names -> our keys. Normalised comparison plus explicit aliases
// for the names that never match mechanically.
const ALIASES: Record<string, string> = {
  "united states": "USA",
  "usa": "USA",
  "cote divoire": "IVO",
  "ivory coast": "IVO",
  "cabo verde": "CPV",
  "cape verde": "CPV",
  "bosnia and herzegovina": "BIH",
  "bosnia herzegovina": "BIH",
  "dr congo": "COD",
  "congo dr": "COD",
  "democratic republic of the congo": "COD",
};

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z ]/g, "")
    .trim();

const NAME_TO_KEY = new Map<string, string>(
  Object.entries(TEAMS).map(([key, t]) => [norm(t.name), key])
);

function teamKey(apiName: string): string | undefined {
  const n = norm(apiName);
  return ALIASES[n] ?? NAME_TO_KEY.get(n);
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

const toDecimal = (american: number) =>
  american > 0 ? 1 + american / 100 : 1 + 100 / -american;

// Fetch and de-vig. Returns null when no key is configured or the API fails.
export async function fetchMarketOdds(): Promise<Map<string, MarketOdds> | null> {
  if (!KEY) return null;
  // local dev restarts wipe the fetch cache and the 30s live poll turns every
  // session into a quota fire — opt in explicitly with ODDS_DEV=1
  if (process.env.NODE_ENV === "development" && !process.env.ODDS_DEV)
    return null;
  // one region + 12h cache = ~2 credits/day; the free tier is 500/month and
  // most of it is already spent this cycle
  const url =
    `https://api.the-odds-api.com/v4/sports/${SPORT}/odds` +
    `?apiKey=${KEY}&regions=us&markets=h2h&oddsFormat=american`;
  let events: any[];
  try {
    const res = await fetch(url, { next: { revalidate: 43200 } }); // 12 h
    if (!res.ok) return null;
    events = await res.json();
    if (!Array.isArray(events)) return null;
  } catch {
    return null;
  }

  const out = new Map<string, MarketOdds>();
  for (const e of events) {
    const homeKey = teamKey(e.home_team ?? "");
    const awayKey = teamKey(e.away_team ?? "");
    if (!homeKey || !awayKey) continue;

    // average de-vigged probabilities across bookmakers
    let sumH = 0;
    let sumD = 0;
    let sumA = 0;
    let books = 0;
    for (const bk of e.bookmakers ?? []) {
      const h2h = (bk.markets ?? []).find((mk: any) => mk.key === "h2h");
      if (!h2h) continue;
      let iH = 0;
      let iD = 0;
      let iA = 0;
      for (const oc of h2h.outcomes ?? []) {
        const implied = 1 / toDecimal(Number(oc.price));
        if (oc.name === e.home_team) iH = implied;
        else if (oc.name === e.away_team) iA = implied;
        else iD = implied; // "Draw"
      }
      const t = iH + iD + iA;
      if (!(t > 0) || !iH || !iA || !iD) continue;
      sumH += iH / t;
      sumD += iD / t;
      sumA += iA / t;
      books++;
    }
    if (!books) continue;

    out.set(pairKey(homeKey, awayKey), {
      homeKey,
      awayKey,
      pHome: sumH / books,
      pDraw: sumD / books,
      pAway: sumA / books,
      books,
    });
  }
  return out;
}
