// API-Football (api-sports.io): id-keyed player photos + position/age for a
// team's current squad. Players are matched to the ESPN lineup by JERSEY
// NUMBER within the correct team (name only as a fallback), so the
// wrong-person failure mode of name search doesn't exist here.

const KEY = process.env.APIFOOTBALL_KEY;
const BASE = "https://v3.football.api-sports.io";

export type SquadEntry = {
  photo: string;
  position?: string; // Goalkeeper / Defender / Midfielder / Attacker
  age?: number;
};

export type SquadIndex = {
  byNumber: Map<string, SquadEntry>;
  byName: Map<string, SquadEntry>;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

async function af(path: string): Promise<any | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "x-apisports-key": KEY },
      next: { revalidate: 86400 }, // squads and team ids barely move
    });
    if (!res.ok) return null;
    const j = await res.json();
    if (!Array.isArray(j.response)) return null;
    return j.response;
  } catch {
    return null;
  }
}

// A few ESPN display names that api-football spells differently.
const NAME_ALIAS: Record<string, string> = {
  "united states": "USA",
  "bosnia-herzegovina": "Bosnia",
  "dr congo": "Congo DR",
  "cape verde islands": "Cape Verde",
};

const teamIdCache = new Map<string, Promise<number | null>>();

// Resolve an api-football team id from the ESPN team name (+ our FIFA-ish
// code as the tiebreaker among search results).
function teamId(espnName: string, code?: string): Promise<number | null> {
  const key = norm(espnName);
  if (!teamIdCache.has(key)) {
    teamIdCache.set(
      key,
      (async () => {
        const q = NAME_ALIAS[key] ?? espnName;
        const list =
          (await af(`/teams?search=${encodeURIComponent(q)}`)) ?? [];
        const nationals = list.filter((t: any) => t.team?.national);
        const pick =
          nationals.find((t: any) => t.team?.code === code) ??
          nationals.find((t: any) => norm(t.team?.name ?? "") === key) ??
          nationals[0];
        return pick?.team?.id ?? null;
      })()
    );
  }
  return teamIdCache.get(key)!;
}

const squadCache = new Map<number, Promise<SquadIndex | null>>();

function squad(id: number): Promise<SquadIndex | null> {
  if (!squadCache.has(id)) {
    squadCache.set(
      id,
      (async () => {
        const resp = await af(`/players/squads?team=${id}`);
        const players = resp?.[0]?.players;
        if (!Array.isArray(players)) return null;
        const byNumber = new Map<string, SquadEntry>();
        const byName = new Map<string, SquadEntry>();
        for (const p of players) {
          if (!p?.photo) continue;
          const entry: SquadEntry = {
            photo: p.photo,
            position: p.position || undefined,
            age: typeof p.age === "number" ? p.age : undefined,
          };
          if (p.number != null) byNumber.set(String(p.number), entry);
          if (p.name) {
            byName.set(norm(p.name), entry);
            // also index by last name for "M. Oyarzabal"-style mismatches
            const last = norm(p.name).split(" ").pop();
            if (last && !byName.has(last)) byName.set(last, entry);
          }
        }
        return { byNumber, byName };
      })()
    );
  }
  return squadCache.get(id)!;
}

// Squad index for a team, or null when the key/team/squad is unavailable.
export async function squadIndex(
  espnName: string,
  code?: string
): Promise<SquadIndex | null> {
  if (!KEY || !espnName) return null;
  const id = await teamId(espnName, code);
  if (!id) return null;
  return squad(id);
}

// --- confirmed lineups (fallback when ESPN's rosters lag) -------------------

const WC_LEAGUE = 1;
const WC_SEASON = 2026;

export type AfLineupPlayer = {
  id: number;
  name: string;
  number: number | null;
  pos: string | null; // G / D / M / F
  grid: string | null; // "row:col", left-to-right columns
};

export type AfLineup = {
  teamId: number;
  formation?: string;
  coach?: string;
  startXI: AfLineupPlayer[];
  substitutes: AfLineupPlayer[];
};

const fixturesByDate = new Map<string, Promise<any[] | null>>();

function fixturesOn(dateYMD: string): Promise<any[] | null> {
  if (!fixturesByDate.has(dateYMD)) {
    fixturesByDate.set(
      dateYMD,
      af(`/fixtures?league=${WC_LEAGUE}&season=${WC_SEASON}&date=${dateYMD}`)
    );
  }
  return fixturesByDate.get(dateYMD)!;
}

// Confirmed lineups for the tie between two teams (ESPN names) on a date.
// Returns null until api-football publishes both starting XIs.
export async function afConfirmedLineups(
  homeName: string,
  awayName: string,
  dateYMD: string,
  homeCode?: string,
  awayCode?: string
): Promise<{ home: AfLineup; away: AfLineup } | null> {
  if (!KEY) return null;
  const [hid, aid, fixtures] = await Promise.all([
    teamId(homeName, homeCode),
    teamId(awayName, awayCode),
    fixturesOn(dateYMD),
  ]);
  if (!hid || !aid || !fixtures) return null;
  const fx = fixtures.find(
    (f: any) =>
      (f.teams?.home?.id === hid && f.teams?.away?.id === aid) ||
      (f.teams?.home?.id === aid && f.teams?.away?.id === hid)
  );
  if (!fx?.fixture?.id) return null;

  // lineups flip from empty to filled ~40min before kickoff — short cache
  let resp: any[] | null = null;
  try {
    const r = await fetch(
      `${BASE}/fixtures/lineups?fixture=${fx.fixture.id}`,
      { headers: { "x-apisports-key": KEY }, next: { revalidate: 120 } }
    );
    if (r.ok) {
      const j = await r.json();
      if (Array.isArray(j.response)) resp = j.response;
    }
  } catch {
    return null;
  }
  if (!resp || resp.length < 2) return null;

  const mk = (t: any): AfLineup => ({
    teamId: t.team?.id,
    formation: t.formation || undefined,
    coach: t.coach?.name || undefined,
    startXI: (t.startXI ?? []).map((p: any) => p.player),
    substitutes: (t.substitutes ?? []).map((p: any) => p.player),
  });
  const homeL = resp.find((t: any) => t.team?.id === hid);
  const awayL = resp.find((t: any) => t.team?.id === aid);
  if (!homeL || !awayL) return null;
  const h = mk(homeL);
  const a = mk(awayL);
  if (h.startXI.length < 11 || a.startXI.length < 11) return null;
  return { home: h, away: a };
}

export const afPlayerPhoto = (id: number) =>
  `https://media.api-sports.io/football/players/${id}.png`;

// Match one lineup player against the squad: jersey number first (exact
// within the team), then full name, then last name.
export function squadLookup(
  idx: SquadIndex | null,
  jersey?: string,
  name?: string
): SquadEntry | undefined {
  if (!idx) return undefined;
  if (jersey && idx.byNumber.has(jersey)) return idx.byNumber.get(jersey);
  if (name) {
    const n = norm(name);
    if (idx.byName.has(n)) return idx.byName.get(n);
    const last = n.split(" ").pop();
    if (last && idx.byName.has(last)) return idx.byName.get(last);
  }
  return undefined;
}
