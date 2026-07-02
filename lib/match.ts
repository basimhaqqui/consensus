import { ESPN_EVENT_ID } from "./data";
import { resolveBatch } from "./faces";
import {
  afConfirmedLineups,
  afPlayerPhoto,
  squadIndex,
  squadLookup,
} from "./apifootball";
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
  photo?: string; // api-football squad photo — id-keyed, matched by jersey
  img?: string | null; // TheSportsDB cutout by name search — the last resort
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
  events: MatchEvent[];
  form?: { home: string[]; away: string[] }; // last five, W/D/L, oldest first
  referee?: string;
  attendance?: number;
};

export type Goal = {
  side: "home" | "away";
  scorer: string;
  assist?: string;
  minute: string;
  tag?: "P" | "OG"; // penalty / own goal
};

// A structured match event (goals, cards, subs) from ESPN's key events —
// drives the events timeline and the win-probability reconstruction.
export type MatchEvent = {
  minute: string; // display, e.g. "45'+2'"
  sortMin: number; // 45.02 — base minute + stoppage fraction, for ordering
  period: number;
  type: "goal" | "own-goal" | "pen-goal" | "yellow" | "red" | "sub";
  side: "home" | "away";
  players: string[]; // scorer/assist, carded player, or [on, off] for subs
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

  const home = mk(comp("home"));
  const away = mk(comp("away"));

  let squads = parseSquads(s);
  // ESPN's rosters often lag the official announcement — when they're still
  // empty pre-match, take the confirmed XIs from api-football instead.
  if (
    (st.state ?? "pre") === "pre" &&
    !squads.some((q) => q.starters.length > 0)
  ) {
    const af = await afConfirmedSquads(s, home, away, hc.date ?? "");
    if (af) squads = af;
  }
  await enrichSquads(squads);

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

  // structured events (goals / cards / subs) for the timeline + win-prob chart
  const EVENT_TYPE: Record<string, MatchEvent["type"]> = {
    goal: "goal",
    "goal---free-kick": "goal",
    "goal---header": "goal",
    "penalty---scored": "pen-goal",
    "own-goal": "own-goal",
    "yellow-card": "yellow",
    "red-card": "red",
    substitution: "sub",
  };
  const sideOfTeam = (name?: string): "home" | "away" | undefined =>
    name && normName(name) === normName(home.name)
      ? "home"
      : name && normName(name) === normName(away.name)
      ? "away"
      : undefined;
  const events: MatchEvent[] = (s.keyEvents ?? [])
    .map((e: any): MatchEvent | null => {
      let type = EVENT_TYPE[e.type?.type ?? ""];
      if (!type) return null;
      const text: string = e.text ?? "";
      if (type === "goal" && /own goal/i.test(text)) type = "own-goal";
      if (type === "goal" && /penalty/i.test(text)) type = "pen-goal";
      let side = sideOfTeam(e.team?.displayName);
      if (!side) return null;
      // ESPN attributes an own goal to the scoring team's benefit — flip to
      // the side of the player who actually put it in
      if (type === "own-goal") side = side === "home" ? "away" : "home";
      const disp: string = e.clock?.displayValue ?? "";
      const m = disp.match(/(\d+)'(?:\+(\d+)')?/);
      const base = m ? parseInt(m[1], 10) : 0;
      const added = m?.[2] ? parseInt(m[2], 10) : 0;
      const players = (e.participants ?? e.athletesInvolved ?? [])
        .map((a: any) => a?.athlete?.displayName ?? a?.displayName ?? a?.name)
        .filter(Boolean);
      return {
        minute: disp,
        sortMin: base + added / 100,
        period: e.period?.number ?? (base > 45 ? 2 : 1),
        type,
        side,
        players,
      };
    })
    .filter((x: MatchEvent | null): x is MatchEvent => x !== null)
    .sort((a: MatchEvent, b: MatchEvent) => a.sortMin - b.sortMin);

  // last-five form per side, oldest first (gameResult is from that team's view)
  let form: MatchDetail["form"];
  for (const t of s.lastFiveGames ?? []) {
    const side = sideOfTeam(t.team?.displayName) ??
      (t.team?.abbreviation === home.abbr ? "home" : t.team?.abbreviation === away.abbr ? "away" : undefined);
    if (!side) continue;
    const letters = (t.events ?? [])
      .map((g: any) => g.gameResult)
      .filter((r: any) => r === "W" || r === "D" || r === "L")
      .slice(0, 5)
      .reverse();
    form = { home: form?.home ?? [], away: form?.away ?? [], [side]: letters } as MatchDetail["form"];
  }

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
    events,
    form,
    referee: s.gameInfo?.officials?.[0]?.displayName,
    attendance:
      typeof s.gameInfo?.attendance === "number"
        ? s.gameInfo.attendance
        : undefined,
  };
}

// ESPN's subbedIn/subbedOut is a boolean after kickoff but an object
// ({ didSub: false }) on pre-match rosters — treat both shapes correctly so a
// confirmed lineup doesn't render everyone as substituted.
function didSub(v: any): boolean {
  return typeof v === "object" && v !== null ? !!v.didSub : !!v;
}

// Build Squads from api-football's confirmed lineups (grid gives left-to-right
// columns per formation row; photos come id-keyed from the same record).
async function afConfirmedSquads(
  s: any,
  home: SideInfo,
  away: SideInfo,
  dateISO: string
): Promise<Squad[] | null> {
  if (!home.name || !away.name || !dateISO) return null;
  const lineups = await afConfirmedLineups(
    home.name,
    away.name,
    dateISO.slice(0, 10),
    home.abbr,
    away.abbr
  );
  if (!lineups) return null;

  // header competitors carry the kit colours parseSquads normally reads
  const colorOf = (abbr?: string) => {
    const c = (s.header?.competitions?.[0]?.competitors ?? []).find(
      (x: any) => x.team?.abbreviation === abbr
    );
    return { color: c?.team?.color, alt: c?.team?.alternateColor };
  };

  const POS_LABEL: Record<string, string> = { G: "GK", D: "DEF", M: "MID", F: "FWD" };

  const build = (
    side: SideInfo,
    lineup: import("./apifootball").AfLineup,
    homeAway: string
  ): Squad => {
    // columns per grid row, for left/centre/right placement
    const rowWidth = new Map<number, number>();
    for (const p of lineup.startXI) {
      const m = p.grid?.match(/^(\d+):(\d+)$/);
      if (m) {
        const r = Number(m[1]);
        rowWidth.set(r, Math.max(rowWidth.get(r) ?? 0, Number(m[2])));
      }
    }
    const toPlayer = (p: import("./apifootball").AfLineupPlayer, starter: boolean): Player => {
      const letter = (p.pos ?? "").toUpperCase().slice(0, 1);
      const pband = band(letter || "M");
      let sideNum = 0;
      const m = p.grid?.match(/^(\d+):(\d+)$/);
      if (m) {
        const width = rowWidth.get(Number(m[1])) ?? 1;
        const t = width > 1 ? (Number(m[2]) - 1) / (width - 1) : 0.5;
        sideNum = t < 0.34 ? -1 : t > 0.66 ? 1 : 0;
      }
      return {
        id: undefined, // no ESPN athlete id on this path
        name: p.name,
        photo: afPlayerPhoto(p.id),
        jersey: p.number != null ? String(p.number) : undefined,
        pos: POS_LABEL[letter] ?? "",
        band: pband,
        side: sideNum,
        starter,
      };
    };
    const cols = colorOf(side.abbr);
    return {
      key: side.key,
      teamId: side.id,
      abbr: side.abbr,
      name: side.name,
      logo: side.logo,
      color: cols.color,
      alt: cols.alt,
      homeAway,
      formation: lineup.formation,
      starters: lineup.startXI.map((p) => toPlayer(p, true)),
      subs: lineup.substitutes.map((p) => toPlayer(p, false)),
    };
  };

  return [build(home, lineups.home, "home"), build(away, lineups.away, "away")];
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

  // api-football squad photos + position/age, matched by jersey number
  // within the right team — id-keyed identity, one request per squad
  const afEnrich = Promise.all(
    squads.map(async (sq) => {
      const idx = await squadIndex(sq.name, sq.abbr);
      if (!idx) return;
      for (const player of [...sq.starters, ...sq.subs]) {
        const hit = squadLookup(idx, player.jersey, player.name);
        if (hit) {
          player.photo = hit.photo;
          (player as any)._afPos = hit.position;
          (player as any)._afAge = hit.age;
        }
      }
    })
  );

  const profiles = await resolveBatch(
    everyone.map((e) => ({
      name: e.player.name,
      nat: e.nat,
      // position band disambiguates same-name players — only when the
      // lineup actually states a position (bench "SUB" is a placeholder)
      band:
        e.player.pos && e.player.pos.toUpperCase() !== "SUB"
          ? e.player.band
          : undefined,
    })),
    4,
    8000
  );
  await Promise.all([badges, afEnrich]);
  everyone.forEach((e, i) => {
    const p = profiles[i];
    e.player.img = p.img;
    const afPos = (e.player as any)._afPos as string | undefined;
    const afAge = (e.player as any)._afAge as number | undefined;
    delete (e.player as any)._afPos;
    delete (e.player as any)._afAge;
    // Replace ESPN's generic "SUB" with the player's real position so the bench
    // shows roles (and sorts GK→DEF→MID→FWD) instead of a wall of "SUB".
    const cur = e.player.pos.toUpperCase();
    if (cur === "SUB" || cur === "") {
      const sp = shortPos(p.position ?? afPos);
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
      position: p.position ?? afPos,
      nationality: p.nationality,
      age: age ?? afAge,
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
