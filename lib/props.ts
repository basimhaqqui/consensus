// Player scoring props from api-football's tournament top scorers. A player's
// "share" is the chance any one of their team's goals is theirs — estimated as
// player goals-per-appearance over team goals-per-game — which lets the score
// grid price "to score" / "2+ goals" jointly with result and totals legs.

import { getStandings } from "./standings";
import { TEAMS } from "./data";
import type { PlayerProp } from "./markets";

const KEY = process.env.APIFOOTBALL_KEY;

type Scorer = { name: string; teamKey: string; share: number };

async function topScorers(): Promise<Scorer[]> {
  if (!KEY) return [];
  let rows: any[] | null = null;
  try {
    const res = await fetch(
      "https://v3.football.api-sports.io/players/topscorers?season=2026&league=1",
      { headers: { "x-apisports-key": KEY }, next: { revalidate: 21600 } }
    );
    if (!res.ok) return [];
    rows = (await res.json()).response;
  } catch {
    return [];
  }
  if (!Array.isArray(rows)) return [];

  // team goals-per-game from the group-stage tables (best available window)
  const groups = await getStandings("fifa.world");
  const gpg = new Map<string, number>();
  for (const g of groups ?? []) {
    for (const r of g.rows) {
      if (r.gp > 0) gpg.set(r.abbr, r.gf / r.gp);
    }
  }

  const nameToKey = new Map(
    Object.entries(TEAMS).map(([k, t]) => [t.name.toLowerCase(), k])
  );

  const out: Scorer[] = [];
  for (const r of rows) {
    const s = r.statistics?.[0];
    const teamKey = nameToKey.get((s?.team?.name ?? "").toLowerCase());
    const apps = s?.games?.appearences ?? 0;
    const goals = s?.goals?.total ?? 0;
    if (!teamKey || apps < 2 || goals < 2) continue;
    const teamGpg = gpg.get(TEAMS[teamKey].code) ?? gpg.get(teamKey) ?? 1.8;
    const share = Math.min(0.6, goals / apps / Math.max(1, teamGpg));
    out.push({ name: r.player?.name ?? "", teamKey, share: +share.toFixed(3) });
  }
  return out;
}

// Props for a set of matches, keyed by match id (home/away side resolved).
export async function matchProps(
  matches: { id: string; homeKey: string; awayKey: string }[]
): Promise<Record<string, PlayerProp[]>> {
  const scorers = await topScorers();
  if (!scorers.length) return {};
  const out: Record<string, PlayerProp[]> = {};
  for (const m of matches) {
    const list: PlayerProp[] = [];
    for (const s of scorers) {
      if (s.teamKey === m.homeKey) list.push({ name: s.name, side: "home", share: s.share });
      if (s.teamKey === m.awayKey) list.push({ name: s.name, side: "away", share: s.share });
    }
    if (list.length) out[m.id] = list.sort((a, b) => b.share - a.share).slice(0, 6);
  }
  return out;
}
