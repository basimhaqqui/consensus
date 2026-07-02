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
