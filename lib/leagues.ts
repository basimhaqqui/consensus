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
  id?: string;
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
  const id = c?.team?.id ? String(c.team.id) : c?.id ? String(c.id) : undefined;
  const rawScore = c?.score;
  const score = rawScore && typeof rawScore === "object"
    ? rawScore.displayValue ?? String(rawScore.value ?? "")
    : rawScore;
  return {
    id,
    name: c?.team?.displayName ?? c?.team?.shortDisplayName ?? "",
    abbr: c?.team?.abbreviation ?? "",
    logo:
      c?.team?.logo ??
      c?.team?.logos?.[0]?.href ??
      (id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png` : undefined),
    score,
    winner: c?.winner,
  };
}

function parseLeagueMatch(e: any): LeagueMatch | null {
  const comp = e.competitions?.[0];
  const cs = comp?.competitors ?? [];
  const home = cs.find((c: any) => c.homeAway === "home") ?? cs[0];
  const away = cs.find((c: any) => c.homeAway === "away") ?? cs[1];
  if (!home || !away) return null;
  const st = comp?.status?.type ?? e.status?.type ?? {};
  const state = (st.state as LeagueMatch["status"]) ?? "pre";
  return {
    id: String(e.id ?? comp?.id ?? ""),
    dateISO: e.date ?? comp?.date ?? "",
    status: state,
    detail: st.shortDetail ?? st.detail ?? "",
    minute: state === "in" ? parseMinute(comp?.status ?? e.status) : undefined,
    home: side(home),
    away: side(away),
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
    .map(parseLeagueMatch)
    .filter((m: LeagueMatch | null): m is LeagueMatch => m !== null)
    .sort((a: LeagueMatch, b: LeagueMatch) => a.dateISO.localeCompare(b.dateISO));

  return {
    name: data.leagues?.[0]?.name ?? slug,
    season: data.leagues?.[0]?.season?.displayName,
    matches,
  };
}

export async function getClubSchedule(
  slug: string,
  teamId: string,
  abbr: string
): Promise<LeagueMatch[]> {
  const now = new Date();
  const ranges = Array.from({ length: 4 }, (_, offset) => {
    const start = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + offset,
      1
    ));
    const end = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth() + offset + 1,
      0
    ));
    return `${formatEspnDate(start)}-${formatEspnDate(end)}`;
  });
  const urls = [
    `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule`,
    ...ranges.map(
      (range) =>
        `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${range}`
    ),
  ];

  const payloads = await Promise.all(
    urls.map((url) =>
      fetch(url, {
        next: { revalidate: 1_800 },
        signal: AbortSignal.timeout(5_000),
      })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null)
    )
  );
  const byId = new Map<string, LeagueMatch>();
  for (const payload of payloads) {
    for (const event of payload?.events ?? []) {
      const match = parseLeagueMatch(event);
      if (!match || (match.home.abbr !== abbr && match.away.abbr !== abbr)) {
        continue;
      }
      byId.set(match.id, match);
    }
  }
  return [...byId.values()].sort((a, b) => a.dateISO.localeCompare(b.dateISO));
}

function formatEspnDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}
