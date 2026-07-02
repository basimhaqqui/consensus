import { ESPN_EVENT_ID } from "./data";
import { resolveBatch } from "./faces";
import { nationalBadge } from "./badges";

const SUMMARY = (slug: string, id: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${id}`;
const SCHEDULE = (slug: string, teamId: string) =>
  `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/teams/${teamId}/schedule`;

// ESPN abbreviation -> our team key (only Ivory Coast differs)
const ALIAS_REV: Record<string, string> = { CIV: "IVO" };
const toKey = (a: string) => ALIAS_REV[a] ?? a;

export type Band = "GK" | "DEF" | "MID" | "FWD";

export type Player = {
  id?: string;
  name: string;
  jersey?: string;
  pos: string;
  band: Band;
  side: number; // -1 left, 0 center, 1 right
  starter: boolean;
  subbedIn?: boolean;
  subbedOut?: boolean;
  subMinute?: string; // e.g. "51'" — when the player came on / went off
  headshot?: string; // ESPN id-keyed headshot — identity-safe, tried first
  img?: string | null; // TheSportsDB cutout by name search — the fallback
  stats?: Record<string, string>; // per-player match stats (name -> value)
  rating?: number; // our model's performance score (see computeRating)
  bio?: PlayerBio; // profile from TheSportsDB
};

// ESPN's standardized athlete headshot. Keyed by the same athlete id the
// lineups feed provides, so it can never show the wrong person (404s for
// players ESPN hasn't photographed — callers fall back to `img`).
export function espnHeadshot(id?: string): string | undefined {
  return id
    ? `https://a.espncdn.com/i/headshots/soccer/players/full/${id}.png`
    : undefined;
}

export type PlayerBio = {
  club?: string;
  position?: string;
  nationality?: string;
  age?: number;
  height?: string;
  desc?: string;
};

export type Squad = {
  key?: string;
  teamId?: string;
  abbr: string;
  name: string;
  logo?: string;
  color?: string; // team primary kit/crest colour (hex, no #)
  alt?: string; // team secondary colour
  homeAway: string;
  formation?: string;
  predicted?: boolean; // our projected XI, not the announced lineup
  starters: Player[];
  subs: Player[];
};

export type SideInfo = {
  abbr: string;
  key?: string;
  id?: string; // ESPN team id
  name: string;
  logo?: string;
  score?: string;
  winner?: boolean;
};

// A previous meeting between the two sides, with the actual result.
export type H2HGame = {
  date?: string;
  comp?: string;
  home: string;
  away: string;
  homeScore: string;
  awayScore: string;
  winner: "home" | "away" | "draw";
};

export type MatchDetail = {
  found: boolean;
  status: "pre" | "in" | "post";
  detail: string;
  venue?: string;
  date?: string;
  home: SideInfo;
  away: SideInfo;
  squads: Squad[];
  hasLineups: boolean;
  h2h: H2HGame[];
  teamStats?: { home: Record<string, string>; away: Record<string, string> };
  goals: Goal[];
};

export type Goal = {
  side: "home" | "away";
  scorer: string;
  assist?: string;
  minute: string;
  tag?: "P" | "OG"; // penalty / own goal
};

const normName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// ESPN only labels bench players "SUB" — turn a resolved profile position
// (TheSportsDB, full words like "Goalkeeper"/"Right Winger") into a short code.
function shortPos(full?: string): string | null {
  if (!full) return null;
  const f = full.toLowerCase();
  if (f.includes("keeper")) return "GK";
  if (f.includes("right-back") || f.includes("right back")) return "RB";
  if (f.includes("left-back") || f.includes("left back")) return "LB";
  if (f.includes("wing-back") || f.includes("wing back")) return "WB";
  if (f.includes("centre-back") || f.includes("center-back") || f.includes("central defender"))
    return "CB";
  if (f.includes("defender") || f.includes("defence") || f.includes("defense")) return "DEF";
  if (f.includes("defensive mid")) return "DM";
  if (f.includes("attacking mid")) return "AM";
  if (f.includes("right wing")) return "RW";
  if (f.includes("left wing")) return "LW";
  if (f.includes("wing")) return "W";
  if (f.includes("midfield")) return "MID";
  if (f.includes("striker") || f.includes("centre-forward") || f.includes("center-forward"))
    return "ST";
  if (f.includes("forward") || f.includes("attack")) return "FW";
  return null;
}

function band(pos: string): Band {
  const p = pos.toUpperCase();
  if (p === "G" || p.startsWith("G")) return "GK";
  if (/B/.test(p) || p.startsWith("CD") || p.startsWith("D")) return "DEF";
  if (/M/.test(p)) return "MID";
  if (/F/.test(p) || /W/.test(p) || p === "ST") return "FWD";
  return "MID";
}

// Our own player rating — a transparent performance score on the familiar
// 0–10 football scale, computed only from the real match events ESPN reports
// (goals, shots, discipline, and for keepers saves vs goals conceded). It is
// our model, not a copied provider number; everyone starts at a neutral 6.5
// and earns or loses from there.
function computeRating(s: Record<string, string>, isGK: boolean): number {
  const n = (k: string) => {
    const v = parseFloat(s[k]);
    return Number.isFinite(v) ? v : 0;
  };
  let r = 6.5;

  // Universal contributions / penalties.
  r += n("totalGoals") * 1.2;
  r += n("goalAssists") * 0.8;
  r -= n("ownGoals") * 1.0;
  r -= n("yellowCards") * 0.3;
  r -= n("redCards") * 1.5;

  if (isGK) {
    r += n("saves") * 0.22;
    r -= n("goalsConceded") * 0.45;
    // a clean sheet that actually faced shots is worth more than an idle one
    if (n("goalsConceded") === 0 && n("shotsFaced") > 0) r += 0.8;
  } else {
    r += n("shotsOnTarget") * 0.18;
    r += n("totalShots") * 0.06; // attacking involvement
    r += n("foulsSuffered") * 0.05; // drew fouls
    r -= n("foulsCommitted") * 0.08;
    r -= n("offsides") * 0.05;
  }

  // Keep it inside a believable band.
  return Math.round(Math.min(9.9, Math.max(4.5, r)) * 10) / 10;
}

// Horizontal position, fine-grained so a wide player (LM/LB/LW) sits wider
// than a half-space player (CM-L/CD-L) on the same side.
//   -2 wide-left · -1 left half-space · 0 central · +1 right half-space · +2 wide-right
function side(pos: string): number {
  const p = pos.toUpperCase();
  if (p.includes("-L")) return -1; // CD-L, CM-L, CF-L …
  if (p.includes("-R")) return 1;
  if (/^L/.test(p)) return -2; // LB, LM, LW, LWB, LF
  if (/^R/.test(p)) return 2;
  return 0; // central
}

export async function fetchMatchDetail(
  fixtureId: string,
  espnId?: string // dynamic upper-round fixtures carry their own event id
): Promise<MatchDetail | null> {
  const id = espnId ?? ESPN_EVENT_ID[fixtureId];
  if (!id) return null;
  return fetchSummary("fifa.world", id);
}

// Generic: works for any competition slug + ESPN event id.
export async function fetchSummary(
  slug: string,
  id: string
): Promise<MatchDetail | null> {
  let s: any;
  try {
    const res = await fetch(SUMMARY(slug, id), { next: { revalidate: 30 } });
    if (!res.ok) return null;
    s = await res.json();
  } catch {
    return null;
  }

  const hc = s.header?.competitions?.[0];
  if (!hc) return null;
  const st = hc.status?.type ?? {};
  const comp = (ha: string) =>
    hc.competitors?.find((c: any) => c.homeAway === ha);
  const mk = (c: any): SideInfo => ({
    abbr: c?.team?.abbreviation ?? "",
    key: c ? toKey(c.team.abbreviation) : undefined,
    id: c?.team?.id ? String(c.team.id) : undefined,
    name: c?.team?.displayName ?? "",
    logo: c?.team?.logo ?? c?.team?.logos?.[0]?.href,
    score: c?.score,
    winner: c?.winner,
  });

  const squads = parseSquads(s);
  await enrichSquads(squads);

  const home = mk(comp("home"));
  const away = mk(comp("away"));

  // Previous meetings: ESPN reports each game from one reference team's
  // perspective (gameResult W/L/D) — remap to home/away so we can show the
  // actual scoreline and who won.
  const h2h: H2HGame[] = (s.headToHeadGames ?? []).flatMap((g: any) => {
    const refName: string = g.team?.displayName ?? "";
    return (g.events ?? [])
      .map((e: any): H2HGame | null => {
        const oppName: string = e.opponent?.displayName ?? "";
        if (!refName || !oppName) return null;
        const refIsHome = String(e.homeTeamId) !== String(e.opponent?.id ?? "");
        const hs = e.homeTeamScore ?? "";
        const as = e.awayTeamScore ?? "";
        const gr = e.gameResult;
        let winner: H2HGame["winner"];
        if (gr === "W" || gr === "L") {
          winner = (gr === "W") === refIsHome ? "home" : "away";
        } else if (Number(hs) !== Number(as)) {
          winner = Number(hs) > Number(as) ? "home" : "away";
        } else {
          winner = "draw";
        }
        return {
          date: e.gameDate,
          comp: e.leagueName ?? e.competitionName,
          home: refIsHome ? refName : oppName,
          away: refIsHome ? oppName : refName,
          homeScore: String(hs),
          awayScore: String(as),
          winner,
        };
      })
      .filter((x: H2HGame | null): x is H2HGame => x !== null);
  });

  // goal scorers from keyEvents, assigned to a side by squad membership
  const nameSide = new Map<string, "home" | "away">();
  squads.forEach((sq) => {
    const s = sq.homeAway === "home" ? "home" : "away";
    [...sq.starters, ...sq.subs].forEach((p) => nameSide.set(normName(p.name), s));
  });
  const goals: Goal[] = (s.keyEvents ?? [])
    .filter((e: any) => e.scoringPlay)
    .map((e: any): Goal | null => {
      const text: string = e.text ?? "";
      const typeText: string = e.type?.text ?? "";
      const isOG = /own goal/i.test(typeText) || /own goal/i.test(text);

      // scorer: prefer athletesInvolved, fall back to parsing the text
      // ("Goal! A 1, B 0. Scorer (Team) ..." or "Own Goal by Scorer (Team)")
      let scorer: string = e.athletesInvolved?.[0]?.displayName ?? "";
      if (!scorer) {
        const og = text.match(/Own Goal by ([^(]+)\(/i);
        const sc = text.match(/\d+\s*,[^.]*\d+\.\s*([^(]+?)\s*\(/);
        const any = text.match(/\.\s*([^(.]+?)\s*\(/);
        scorer = (og?.[1] ?? sc?.[1] ?? any?.[1] ?? "").trim();
      }
      if (!scorer) return null;

      let assist = e.athletesInvolved?.[1]?.displayName as string | undefined;
      if (!assist) assist = text.match(/Assisted by ([^.]+)\./)?.[1]?.trim();

      let side = nameSide.get(normName(scorer));
      // text says "(Team)" — use it if name match failed
      if (!side) {
        const team = text.match(/\(([^)]+)\)/)?.[1];
        if (team && normName(team) === normName(home.name)) side = "home";
        else if (team && normName(team) === normName(away.name)) side = "away";
      }
      if (isOG && side) side = side === "home" ? "away" : "home";
      if (!side) return null;

      return {
        side,
        scorer,
        assist,
        minute: e.clock?.displayValue ?? "",
        tag: isOG ? "OG" : /penalty/i.test(typeText) ? "P" : undefined,
      };
    })
    .filter((g: Goal | null): g is Goal => g !== null);

  // team match stats from the boxscore
  let teamStats: MatchDetail["teamStats"];
  if (s.boxscore?.teams) {
    const byAbbr: Record<string, Record<string, string>> = {};
    s.boxscore.teams.forEach((t: any) => {
      const m: Record<string, string> = {};
      (t.statistics ?? []).forEach((st: any) => {
        if (st?.name) m[st.name] = st.displayValue;
      });
      byAbbr[t.team?.abbreviation] = m;
    });
    if (byAbbr[home.abbr] && byAbbr[away.abbr]) {
      teamStats = { home: byAbbr[home.abbr], away: byAbbr[away.abbr] };
    }
  }

  return {
    found: true,
    status: (st.state as MatchDetail["status"]) ?? "pre",
    detail: st.shortDetail ?? st.detail ?? "",
    venue: s.gameInfo?.venue?.fullName,
    date: hc.date,
    home,
    away,
    squads,
    hasLineups: squads.some((q) => q.starters.length > 0),
    h2h,
    teamStats,
    goals,
  };
}

// ESPN's subbedIn/subbedOut is a boolean after kickoff but an object
// ({ didSub: false }) on pre-match rosters — treat both shapes correctly so a
// confirmed lineup doesn't render everyone as substituted.
function didSub(v: any): boolean {
  return typeof v === "object" && v !== null ? !!v.didSub : !!v;
}

// Map ESPN's raw summary rosters to our Squad shape (no face resolution).
function parseSquads(s: any): Squad[] {
  // Team colours sometimes only appear on the header competitors (e.g. the
  // alternate colour is missing from rosters) — index them as a fallback.
  const headerColors = new Map<string, { color?: string; alt?: string }>();
  for (const c of s.header?.competitions?.[0]?.competitors ?? []) {
    if (c?.team?.abbreviation) {
      headerColors.set(c.team.abbreviation, {
        color: c.team.color,
        alt: c.team.alternateColor,
      });
    }
  }
  // substitution minutes by athlete id, from the match key events
  const subMinutes = new Map<string, string>();
  for (const e of s.keyEvents ?? []) {
    if (e?.type?.type !== "substitution") continue;
    const minute = e.clock?.displayValue;
    if (!minute) continue;
    for (const a of e.participants ?? e.athletesInvolved ?? []) {
      const id = a?.id ?? a?.athlete?.id;
      if (id) subMinutes.set(String(id), minute);
    }
  }

  return (s.rosters ?? []).map((r: any) => {
    const players: Player[] = (r.roster ?? []).map((p: any) => {
      const pos = p.position?.abbreviation ?? "";
      const pband = band(pos);
      const stats: Record<string, string> | undefined = Array.isArray(p.stats)
        ? p.stats.reduce((acc: Record<string, string>, st: any) => {
            if (st?.name) acc[st.name] = st.displayValue;
            return acc;
          }, {})
        : undefined;
      const appeared = !!p.starter || didSub(p.subbedIn);
      return {
        id: p.athlete?.id,
        name: p.athlete?.displayName ?? p.athlete?.shortName ?? "—",
        headshot: espnHeadshot(p.athlete?.id ? String(p.athlete.id) : undefined),
        jersey: p.jersey,
        pos,
        band: pband,
        side: side(pos),
        starter: !!p.starter,
        subbedIn: didSub(p.subbedIn),
        subbedOut: didSub(p.subbedOut),
        subMinute:
          didSub(p.subbedIn) || didSub(p.subbedOut)
            ? subMinutes.get(String(p.athlete?.id ?? ""))
            : undefined,
        stats,
        rating:
          appeared && stats ? computeRating(stats, pband === "GK") : undefined,
      };
    });
    const hcol = headerColors.get(r.team?.abbreviation) ?? {};
    return {
      key: toKey(r.team?.abbreviation ?? ""),
      teamId: r.team?.id ? String(r.team.id) : undefined,
      abbr: r.team?.abbreviation ?? "",
      name: r.team?.displayName ?? "",
      logo: r.team?.logo ?? r.team?.logos?.[0]?.href,
      color: r.team?.color ?? hcol.color,
      alt: r.team?.alternateColor ?? hcol.alt,
      homeAway: r.homeAway,
      formation: r.formation,
      starters: players.filter((p) => p.starter),
      subs: players.filter((p) => !p.starter),
    };
  });
}

// Resolve real face cutouts + profile positions server-side so they're
// preloaded in the HTML. For national teams, also swap ESPN's country FLAG
// for the federation crest (clubs already come with their real crest).
async function enrichSquads(squads: Squad[]): Promise<void> {
  const badges = Promise.all(
    squads.map(async (sq) => {
      if (sq.logo?.includes("/teamlogos/countries/")) {
        const badge = await nationalBadge(sq.name);
        if (badge) sq.logo = badge;
      }
    })
  );

  const everyone: { player: Player; nat: string }[] = squads.flatMap((sq) =>
    [...sq.starters, ...sq.subs].map((player) => ({ player, nat: sq.name }))
  );
  if (everyone.length === 0) {
    await badges;
    return;
  }
  const profiles = await resolveBatch(
    everyone.map((e) => ({ name: e.player.name, nat: e.nat })),
    4,
    8000
  );
  await badges;
  everyone.forEach((e, i) => {
    const p = profiles[i];
    e.player.img = p.img;
    // Replace ESPN's generic "SUB" with the player's real position so the bench
    // shows roles (and sorts GK→DEF→MID→FWD) instead of a wall of "SUB".
    const cur = e.player.pos.toUpperCase();
    if (cur === "SUB" || cur === "") {
      const sp = shortPos(p.position);
      if (sp) {
        e.player.pos = sp;
        e.player.band = band(sp);
        e.player.side = side(sp);
      }
    }
    let age: number | undefined;
    if (p.born) {
      const ms = Date.now() - new Date(p.born).getTime();
      const yrs = Math.floor(ms / (365.25 * 24 * 3600 * 1000));
      if (yrs > 10 && yrs < 60) age = yrs;
    }
    e.player.bio = {
      club: p.club,
      position: p.position,
      nationality: p.nationality,
      age,
      height: p.height,
      desc: p.desc,
    };
  });
}

// ---------------------------------------------------------------------------
// Predicted lineups — our own projection, shown before the official lineups
// drop (~1 hour before kickoff): each side's XI and formation from its most
// recent completed match. No provider "probable lineups" involved.
// ---------------------------------------------------------------------------

async function lastMatchSquad(
  slug: string,
  teamId: string,
  homeAway: string
): Promise<Squad | null> {
  try {
    const sres = await fetch(SCHEDULE(slug, teamId), {
      next: { revalidate: 600 },
    });
    if (!sres.ok) return null;
    const sched = await sres.json();
    const done = (sched.events ?? [])
      .filter((e: any) => e.competitions?.[0]?.status?.type?.completed)
      .sort(
        (a: any, b: any) =>
          new Date(a.date).getTime() - new Date(b.date).getTime()
      );
    const last = done[done.length - 1];
    if (!last) return null;

    const mres = await fetch(SUMMARY(slug, last.id), {
      next: { revalidate: 3600 }, // finished match — lineup won't change
    });
    if (!mres.ok) return null;
    const mine = parseSquads(await mres.json()).find(
      (q) => q.teamId === String(teamId)
    );
    if (!mine || mine.starters.length === 0) return null;

    return {
      ...mine,
      homeAway,
      predicted: true,
      // Project the XI only — strip last match's events so nothing reads as
      // if it already happened in this game.
      starters: mine.starters.map((p) => ({
        ...p,
        subbedIn: false,
        subbedOut: false,
        stats: undefined,
        rating: undefined,
      })),
      subs: [],
    };
  } catch {
    return null;
  }
}

export async function fetchPredictedSquads(
  slug: string,
  homeId: string,
  awayId: string
): Promise<Squad[] | null> {
  const [home, away] = await Promise.all([
    lastMatchSquad(slug, homeId, "home"),
    lastMatchSquad(slug, awayId, "away"),
  ]);
  if (!home || !away) return null;
  const squads = [home, away];
  await enrichSquads(squads);
  return squads;
}
