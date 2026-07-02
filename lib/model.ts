// ---------------------------------------------------------------------------
// Consensus forecasting engine.
//
// v1 method: an Elo-style team rating feeds a Poisson goals model that returns
// win / draw / win probabilities, the most likely scoreline, and expected
// goals. Ratings are calibrated so the tournament favourites line up with the
// live market title-odds (France, Argentina, Spain, England...). This is a
// legitimate, transparent forecasting approach — not scraped book numbers.
//
// v2 will blend in live sportsbook odds + prediction-market prices via API;
// the UI already reserves slots for those feeds.
// ---------------------------------------------------------------------------

export type Outcome = {
  pHome: number; // P(home win)
  pDraw: number; // P(draw)
  pAway: number; // P(away win)
  lambdaHome: number; // expected goals, home
  lambdaAway: number; // expected goals, away
  topScore: { home: number; away: number; p: number }; // most likely scoreline
};

// Poisson PMF
function poisson(k: number, lambda: number): number {
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

// Expected goals for each side from rating difference.
// supremacy (goal expectation gap) scales with rating diff; total goals held
// roughly constant so blowouts and tight games both look sane.
//
// Constants fitted by scripts/backtest.mjs: online replay of 10,789
// internationals (2015+), minimising W/D/L log loss. div=210 / BASE=1.35 with
// the Dixon-Coles rho=-0.1 below ranked #1 of the grid and calibrates cleanly
// (predicted 86% -> actual 88%); the old div=90 / cap=2.2 ranked dead last
// and called 75% shots that landed 53%.
function expectedGoals(ratingHome: number, ratingAway: number) {
  const BASE = 1.35; // average goals per team at even strength
  const diff = ratingHome - ratingAway; // includes any home edge baked into rating
  const supremacy = Math.max(-3.0, Math.min(3.0, diff / 210)); // cap extremes
  const lambdaHome = Math.max(0.25, BASE + supremacy / 2);
  const lambdaAway = Math.max(0.25, BASE - supremacy / 2);
  return { lambdaHome, lambdaAway };
}

// Dixon-Coles low-score adjustment (fitted rho): independent Poissons
// under-produce draws; a negative rho inflates 0-0 / 1-1 and deflates the
// 1-0 / 0-1 cells to match how often real matches actually stay level.
const RHO = -0.1;
function tau(h: number, a: number, lh: number, la: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * RHO;
  if (h === 0 && a === 1) return 1 + lh * RHO;
  if (h === 1 && a === 0) return 1 + la * RHO;
  if (h === 1 && a === 1) return 1 - RHO;
  return 1;
}

export function forecast(ratingHome: number, ratingAway: number): Outcome {
  const { lambdaHome, lambdaAway } = expectedGoals(ratingHome, ratingAway);

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  let topScore = { home: 0, away: 0, p: 0 };

  const MAX = 8;
  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      const p =
        poisson(h, lambdaHome) *
        poisson(a, lambdaAway) *
        tau(h, a, lambdaHome, lambdaAway);
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (p > topScore.p) topScore = { home: h, away: a, p };
    }
  }

  // normalise (tail beyond MAX is tiny but keep it exact)
  const total = pHome + pDraw + pAway;
  return {
    pHome: pHome / total,
    pDraw: pDraw / total,
    pAway: pAway / total,
    lambdaHome,
    lambdaAway,
    topScore,
  };
}

// Probability a side advances given win/draw/win probs — draws resolve by
// replaying the same Poisson model over 30 minutes of extra time (each side's
// scoring rate scaled to 30/90), and residual ET draws go to penalties as a
// coin flip. No extra constants: the favourite's ET edge falls straight out
// of the goal model.
export function advanceFrom(
  pHome: number,
  pDraw: number,
  lambdaHome: number,
  lambdaAway: number
) {
  const lh = lambdaHome / 3;
  const la = lambdaAway / 3;
  let etHome = 0;
  let etDraw = 0;
  let etAway = 0;
  const MAX = 5; // 30 minutes — tails beyond 5 goals are negligible
  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      const p = poisson(h, lh) * poisson(a, la);
      if (h > a) etHome += p;
      else if (h === a) etDraw += p;
      else etAway += p;
    }
  }
  const t = etHome + etDraw + etAway;
  const homeKO = (etHome + etDraw / 2) / t; // share of 90' draws home survives
  const pHomeAdv = pHome + pDraw * homeKO;
  return { home: pHomeAdv, away: 1 - pHomeAdv };
}

export function advanceProb(o: Outcome) {
  return advanceFrom(o.pHome, o.pDraw, o.lambdaHome, o.lambdaAway);
}

export type LiveProb = { pHome: number; pDraw: number; pAway: number };

// In-play win/draw/win from the CURRENT score + minutes remaining.
// Remaining goals for each side are Poisson with the pre-match scoring rate
// scaled to the time left; the final result is current score + remaining goals.
export function inPlay(
  lambdaHome: number,
  lambdaAway: number,
  goalsHome: number,
  goalsAway: number,
  minutesRemaining: number
): LiveProb {
  const frac = Math.max(0, Math.min(1, minutesRemaining / 90));
  const lh = lambdaHome * frac;
  const la = lambdaAway * frac;

  let pHome = 0;
  let pDraw = 0;
  let pAway = 0;
  const MAX = 9;
  for (let h = 0; h <= MAX; h++) {
    for (let a = 0; a <= MAX; a++) {
      const p = poisson(h, lh) * poisson(a, la);
      const fh = goalsHome + h;
      const fa = goalsAway + a;
      if (fh > fa) pHome += p;
      else if (fh === fa) pDraw += p;
      else pAway += p;
    }
  }
  const t = pHome + pDraw + pAway;
  return { pHome: pHome / t, pDraw: pDraw / t, pAway: pAway / t };
}

// A sending-off is worth roughly 1.4 goals of swing over a full match:
// the short-handed side's scoring rate drops ~30%, the opponent's rises ~15%.
export function redAdjust(
  lambdaHome: number,
  lambdaAway: number,
  redsHome: number,
  redsAway: number
) {
  return {
    lh: lambdaHome * 0.7 ** redsHome * 1.15 ** redsAway,
    la: lambdaAway * 0.7 ** redsAway * 1.15 ** redsHome,
  };
}

// Minimal event shape the timeline needs (structurally matches MatchEvent).
type TimelineEvent = {
  sortMin: number;
  type: string;
  side: "home" | "away";
};

export type WinProbPoint = { m: number } & LiveProb;

// Reconstruct the in-play win/draw/win series minute by minute from the
// pre-match scoring rates and the match events: at each minute the score and
// red-card counts so far feed the same inPlay model that powers live cards.
// Finished matches get a terminal point pinned to the actual result.
export function winProbSeries(
  lambdaHome: number,
  lambdaAway: number,
  events: TimelineEvent[],
  status: "in" | "post",
  currentMinute?: number
): WinProbPoint[] {
  const last = status === "post" ? 90 : Math.max(1, Math.min(90, currentMinute ?? 1));
  const pts: WinProbPoint[] = [];
  for (let m = 0; m <= last; m++) {
    let gh = 0;
    let ga = 0;
    let rh = 0;
    let ra = 0;
    for (const e of events) {
      if (Math.min(Math.floor(e.sortMin), 90) > m) continue;
      if (e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal") {
        if (e.side === "home") gh++;
        else ga++;
      } else if (e.type === "red") {
        if (e.side === "home") rh++;
        else ra++;
      }
    }
    const { lh, la } = redAdjust(lambdaHome, lambdaAway, rh, ra);
    // at m=90 nothing remains, so the point pins itself to the actual result
    pts.push({ m, ...inPlay(lh, la, gh, ga, 90 - m) });
  }
  return pts;
}

export function americanFromProb(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.5) {
    const v = Math.round((-100 * p) / (1 - p));
    return `${v}`;
  }
  const v = Math.round((100 * (1 - p)) / p);
  return `+${v}`;
}
