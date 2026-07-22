// Multi-competition support. ESPN uses the same endpoints for every league —
// just a different slug — so live scores + match detail generalise to any of
// these. The tournament simulator remains World-Cup-only; club pages use match forecasts.

export type Competition = { slug: string; name: string; short: string };

export const COMPETITIONS: Competition[] = [
  { slug: "fifa.world", name: "World Cup", short: "World Cup" },
  { slug: "uefa.champions", name: "Champions League", short: "UCL" },
  { slug: "uefa.europa", name: "Europa League", short: "UEL" },
  { slug: "uefa.europa.conf", name: "Conference League", short: "UECL" },
  { slug: "eng.1", name: "Premier League", short: "EPL" },
  { slug: "esp.1", name: "La Liga", short: "La Liga" },
  { slug: "ita.1", name: "Serie A", short: "Serie A" },
  { slug: "ger.1", name: "Bundesliga", short: "Bundesliga" },
  { slug: "fra.1", name: "Ligue 1", short: "Ligue 1" },
  { slug: "usa.1", name: "MLS", short: "MLS" },
  { slug: "bra.1", name: "Brasileirão", short: "Brazil" },
];

export const competitionBySlug = (slug: string) =>
  COMPETITIONS.find((c) => c.slug === slug);

export type LeagueSide = {
  name: string;
  abbr: string;
  logo?: string;
  score?: string;
  winner?: boolean;
};

export type LeagueMatch = {
  id: string;
  dateISO: string;
  status: "pre" | "in" | "post";
  detail: string;
  minute?: number; // for live in-play odds
  home: LeagueSide;
  away: LeagueSide;
};

function parseMinute(status: any): number | undefined {
  if (/HALFTIME/.test(status?.type?.name ?? "")) return 45;
  const m = String(status?.displayClock ?? "").match(/(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (typeof status?.clock === "number") return Math.round(status.clock / 60);
  return undefined;
}

export type LeagueScoreboard = {
  name: string;
  season?: string;
  matches: LeagueMatch[];
};

function side(c: any): LeagueSide {
  return {
    name: c?.team?.displayName ?? c?.team?.shortDisplayName ?? "",
    abbr: c?.team?.abbreviation ?? "",
    logo: c?.team?.logo,
    score: c?.score,
    winner: c?.winner,
  };
}

export async function getLeagueScoreboard(
  slug: string
): Promise<LeagueScoreboard | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard`;
  let data: any;
  try {
    const r = await fetch(url, {
      next: { revalidate: 30 },
      signal: AbortSignal.timeout(5_000),
    });
    if (!r.ok) return null;
    data = await r.json();
  } catch {
    return null;
  }

  const matches: LeagueMatch[] = (data.events ?? [])
    .map((e: any): LeagueMatch | null => {
      const comp = e.competitions?.[0];
      const cs = comp?.competitors ?? [];
      const home = cs.find((c: any) => c.homeAway === "home") ?? cs[0];
      const away = cs.find((c: any) => c.homeAway === "away") ?? cs[1];
      if (!home || !away) return null;
      const st = e.status?.type ?? {};
      const state = (st.state as LeagueMatch["status"]) ?? "pre";
      return {
        id: e.id,
        dateISO: e.date,
        status: state,
        detail: st.shortDetail ?? st.detail ?? "",
        minute: state === "in" ? parseMinute(e.status) : undefined,
        home: side(home),
        away: side(away),
      };
    })
    .filter((m: LeagueMatch | null): m is LeagueMatch => m !== null)
    .sort((a: LeagueMatch, b: LeagueMatch) => a.dateISO.localeCompare(b.dateISO));

  return {
    name: data.leagues?.[0]?.name ?? slug,
    season: data.leagues?.[0]?.season?.displayName,
    matches,
  };
}
