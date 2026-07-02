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
function expectedGoals(ratingHome: number, ratingAway: number) {
  const BASE = 1.35; // league-average goals per team in a knockout match
  const diff = ratingHome - ratingAway; // includes any home edge baked into rating
  const supremacy = Math.max(-2.2, Math.min(2.2, diff / 90)); // cap extremes
  const lambdaHome = Math.max(0.25, BASE + supremacy / 2);
  const lambdaAway = Math.max(0.25, BASE - supremacy / 2);
  return { lambdaHome, lambdaAway };
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
      const p = poisson(h, lambdaHome) * poisson(a, lambdaAway);
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

// Probability a side advances given win/draw/win probs — draws resolve via
// ET + penalties, nudged slightly toward the stronger side.
export function advanceFrom(
  pHome: number,
  pDraw: number,
  ratingHome: number,
  ratingAway: number
) {
  const edge = Math.max(0, Math.min(0.15, (ratingHome - ratingAway) / 2000));
  const homeKO = 0.5 + edge; // share of draws the home side wins on
  const pHomeAdv = pHome + pDraw * homeKO;
  return { home: pHomeAdv, away: 1 - pHomeAdv };
}

export function advanceProb(o: Outcome, ratingHome: number, ratingAway: number) {
  return advanceFrom(o.pHome, o.pDraw, ratingHome, ratingAway);
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

export function americanFromProb(p: number): string {
  if (p <= 0) return "—";
  if (p >= 0.5) {
    const v = Math.round((-100 * p) / (1 - p));
    return `${v}`;
  }
  const v = Math.round((100 * (1 - p)) / p);
  return `+${v}`;
}
