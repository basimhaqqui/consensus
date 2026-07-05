import {
  FIXTURES,
  TEAMS,
  teamRating,
  teamStyle,
  type Fixture,
  type Team,
  type RatingSource,
} from "./data";
import {
  forecast,
  advanceProb,
  advanceFrom,
  americanFromProb,
  inPlay,
  type Outcome,
  type LiveProb,
} from "./model";

export type LiveState = {
  detail: string; // e.g. "67'", "HT", "FT", "FT-Pens"
  clock?: string; // live display clock
  minute?: number; // parsed match minute, for in-play model
  pens?: { home: number; away: number };
};

export type MatchView = {
  id: string;
  date: string;
  kickoffISO: string;
  venue: string;
  homeKey: string;
  awayKey: string;
  home: Team;
  away: Team;
  status: "scheduled" | "live" | "final";
  score?: { home: number; away: number };
  live?: LiveState;
  outcome: Outcome;
  advance: { home: number; away: number };
  homeML: string;
  awayML: string;
  confidence: number;
  modelPickKey: string; // team key the model favours to advance
  winnerKey?: string; // who actually advanced (incl. pens), if decided
  hit?: boolean; // did the model's pick advance?
  liveProb?: LiveProb; // in-play win/draw/win, when a match is live
  liveAdvance?: { home: number; away: number }; // in-play advance odds (ET/pens)
  minute?: number; // current match minute, when live
  espnId?: string; // ESPN event id, for dynamic (upper-round) fixtures
  market?: {
    pHome: number; // live sportsbook 90' probabilities (de-vigged, averaged)
    pDraw: number;
    pAway: number;
    advHome: number; // market's implied advance odds (our ET/pens machinery)
    books: number;
    delta?: number; // books' advance movement vs ~a day ago
  };
};

// Build the model-only view for a fixture (no live overlay yet).
function buildModel(f: Fixture, source: RatingSource): MatchView {
  const home = TEAMS[f.home];
  const away = TEAMS[f.away];
  const rHome = teamRating(f.home, source) + (f.homeAdv ?? 0);
  const rAway = teamRating(f.away, source);
  const outcome = forecast(
    rHome,
    rAway,
    undefined,
    teamStyle(f.home),
    teamStyle(f.away)
  );
  const advance = advanceProb(outcome);
  const confidence = Math.abs(advance.home - advance.away);
  const modelPickKey = advance.home >= advance.away ? f.home : f.away;

  return {
    id: f.id,
    date: f.date,
    kickoffISO: f.kickoffISO,
    venue: f.venue,
    homeKey: f.home,
    awayKey: f.away,
    home,
    away,
    status: f.status === "final" ? "final" : "scheduled",
    score: f.score,
    outcome,
    advance,
    homeML: americanFromProb(advance.home),
    awayML: americanFromProb(advance.away),
    confidence,
    modelPickKey,
  };
}

// Resolve winner + hit once a score/winner is known.
function resolveResult(m: MatchView, winnerKey?: string) {
  let wk = winnerKey;
  if (!wk && m.status === "final" && m.score) {
    wk =
      m.score.home === m.score.away
        ? undefined
        : m.score.home > m.score.away
        ? m.homeKey
        : m.awayKey;
  }
  m.winnerKey = wk;
  if (wk) m.hit = m.modelPickKey === wk;
}

// Static, model-only matches (no network) — used as a safe fallback.
export function getMatches(source: RatingSource = "model"): MatchView[] {
  return FIXTURES.map((f) => {
    const m = buildModel(f, source);
    resolveResult(m);
    return m;
  });
}

// Apply a live overlay (from ESPN) onto the model matches.
export type LiveOverlay = {
  // keyed by fixture id
  status: "scheduled" | "live" | "final";
  homeScore?: number;
  awayScore?: number;
  winnerKey?: string;
  live?: LiveState;
};

// Build a full MatchView for one fixture, with an optional live overlay.
// Used for the static R32 fixtures and for dynamic upper-round pairings.
export function buildMatchView(
  f: Fixture,
  ov: LiveOverlay | undefined,
  source: RatingSource = "model"
): MatchView {
  const m = buildModel(f, source);
  if (ov) {
    m.status = ov.status;
    if (ov.homeScore !== undefined && ov.awayScore !== undefined) {
      m.score = { home: ov.homeScore, away: ov.awayScore };
    }
    m.live = ov.live;
    if (
      ov.status === "live" &&
      m.score &&
      ov.live?.minute !== undefined
    ) {
      m.minute = ov.live.minute;
      const remaining = Math.max(1, Math.min(90, 90 - ov.live.minute));
      m.liveProb = inPlay(
        m.outcome.lambdaHome,
        m.outcome.lambdaAway,
        m.score.home,
        m.score.away,
        remaining
      );
      m.liveAdvance = advanceFrom(
        m.liveProb.pHome,
        m.liveProb.pDraw,
        m.outcome.lambdaHome,
        m.outcome.lambdaAway
      );
    }
    resolveResult(m, ov.winnerKey);
  } else {
    resolveResult(m);
  }
  return m;
}

export function applyOverlay(
  overlays: Record<string, LiveOverlay>,
  source: RatingSource = "model"
): MatchView[] {
  return FIXTURES.map((f) => buildMatchView(f, overlays[f.id], source));
}

// A knockout match parsed straight from the ESPN scoreboard, keyed by its
// unordered team pair — lets the bracket attach live data to upper-round
// pairings that don't exist in the static fixture list.
export type KnockoutEvent = {
  homeKey: string;
  awayKey: string;
  overlay: LiveOverlay;
  date: string; // display, e.g. "Sat Jul 4"
  kickoffISO: string;
  venue: string;
  espnId?: string;
};

export function trackRecord(matches: MatchView[]) {
  const decided = matches.filter((m) => m.hit !== undefined);
  const hits = decided.filter((m) => m.hit).length;
  return { played: decided.length, hits };
}

export function tournamentFav(
  matches: MatchView[],
  source: RatingSource = "model"
): Team | undefined {
  const alive = new Set<string>();
  matches.forEach((m) => {
    if (m.status === "final") {
      if (m.winnerKey) alive.add(m.winnerKey);
    } else {
      alive.add(m.homeKey);
      alive.add(m.awayKey);
    }
  });
  const best = Object.keys(TEAMS)
    .filter((k) => alive.has(k))
    .sort((a, b) => teamRating(b, source) - teamRating(a, source))[0];
  return best ? TEAMS[best] : undefined;
}
