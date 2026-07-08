// Paper bankroll: the model bets a virtual $1,000 with a standing aim of
// growing it to at least $10,000 — no deadline. Runs in the ledger cron.
//
// Markets: full menu — result (ML/double chance), totals, BTTS, clean sheets,
// team-to-score, anytime scorers, and correlated same-match combos.
//
// Pricing: the books only quote 1X2, so the bot back-solves the goal
// expectations implied by the books' own de-vigged 1X2 (fit lambdas to match
// pH/pD/pA), prices every derived market off THAT grid, and takes a 3% payout
// haircut per leg (plus 5% extra on combos) as margin. Its edge is then
// model-vs-books on every market, not model-vs-itself.
//
// Policy: no deadline means the growth-optimal route to ANY target is Kelly
// staking. FULL Kelly on the highest-EV market per match (EV >= 8% at
// offered odds) — the most aggressive sizing that still maximizes growth;
// anything past it trades EV for extra variance. The target is a milestone,
// not a stop: the bankroll compounds through the WC and into the leagues.
//
// Grading: 90' data straight from ESPN's event feed (regulation goals =
// periods 1-2, own goals flipped, scorer names matched by surname) — falls
// back to "AET/pens means 90' draw" when the event feed is unavailable.

import { readFileSync, writeFileSync } from "node:fs";

const SITE = process.env.SITE_URL ?? "https://consensus-football.vercel.app";
const AF_KEY = process.env.APIFOOTBALL_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const OUT = new URL("../data/bankroll.json", import.meta.url);

const TARGET = 10000; // milestone, not a deadline or a stop
const EV_MIN = 0.08; // bet only when model EV at offered odds >= 8%
const KELLY_FRACTION = 1.0; // full Kelly — maximum aggression that is still growth-optimal
const STAKE_CAP = 0.25; // per bet, of equity
const EXPOSURE_CAP = 0.8; // total open stakes, of equity
const MARGIN = 0.97; // per-leg payout haircut
const COMBO_MARGIN = 0.95; // extra haircut on combos

// --- score grid (mirrors lib/model.ts) ---------------------------------------

const RHO = -0.07;
const MAX = 8;
const poisson = (k, l) => {
  let f = 1;
  for (let i = 2; i <= k; i++) f *= i;
  return (Math.pow(l, k) * Math.exp(-l)) / f;
};
const tau = (h, a, lh, la) =>
  h === 0 && a === 0 ? 1 - lh * la * RHO
  : h === 0 && a === 1 ? 1 + lh * RHO
  : h === 1 && a === 0 ? 1 + la * RHO
  : h === 1 && a === 1 ? 1 - RHO
  : 1;

function grid(lh, la) {
  const p = [];
  let t = 0;
  for (let h = 0; h <= MAX; h++) {
    p[h] = [];
    for (let a = 0; a <= MAX; a++) {
      const v = poisson(h, lh) * poisson(a, la) * tau(h, a, lh, la);
      p[h][a] = v;
      t += v;
    }
  }
  return { p, t };
}

const gridProb = (g, w) => {
  let s = 0;
  for (let h = 0; h <= MAX; h++)
    for (let a = 0; a <= MAX; a++) s += g.p[h][a] * w(h, a);
  return s / g.t;
};

function resultProbs(g) {
  let pH = 0, pD = 0, pA = 0;
  for (let h = 0; h <= MAX; h++)
    for (let a = 0; a <= MAX; a++) {
      if (h > a) pH += g.p[h][a];
      else if (h === a) pD += g.p[h][a];
      else pA += g.p[h][a];
    }
  return { pH: pH / g.t, pD: pD / g.t, pA: pA / g.t };
}

// Back-solve the goal expectations the books' 1X2 implies.
function booksLambdas(books) {
  let best = null;
  for (let diff = -900; diff <= 900; diff += 25) {
    for (let mu = 0.05; mu <= 0.55; mu += 0.025) {
      const s = Math.max(-3, Math.min(3, diff / 300));
      const lh = Math.exp(mu + s / 2);
      const la = Math.exp(mu - s / 2);
      const r = resultProbs(grid(lh, la));
      const err =
        (r.pH - books.pHome) ** 2 +
        (r.pD - books.pDraw) ** 2 +
        (r.pA - books.pAway) ** 2;
      if (!best || err < best.err) best = { lh, la, err };
    }
  }
  return best;
}

// --- market menu ---------------------------------------------------------------

// weight(h,a) in [0,1]; grade(reg) -> true/false against the 90' record
function legMenu(m, players) {
  const H = m.homeKey, A = m.awayKey;
  const legs = [
    { key: "home", label: `${H} win`, w: (h, a) => (h > a ? 1 : 0), grade: (r) => r.h > r.a },
    { key: "away", label: `${A} win`, w: (h, a) => (h < a ? 1 : 0), grade: (r) => r.h < r.a },
    { key: "dc-1x", label: `${H} or draw`, w: (h, a) => (h >= a ? 1 : 0), grade: (r) => r.h >= r.a },
    { key: "dc-x2", label: `${A} or draw`, w: (h, a) => (h <= a ? 1 : 0), grade: (r) => r.h <= r.a },
    { key: "o1.5", label: "Over 1.5 goals", w: (h, a) => (h + a > 1 ? 1 : 0), grade: (r) => r.h + r.a > 1 },
    { key: "u1.5", label: "Under 1.5 goals", w: (h, a) => (h + a < 2 ? 1 : 0), grade: (r) => r.h + r.a < 2 },
    { key: "o2.5", label: "Over 2.5 goals", w: (h, a) => (h + a > 2 ? 1 : 0), grade: (r) => r.h + r.a > 2 },
    { key: "u2.5", label: "Under 2.5 goals", w: (h, a) => (h + a < 3 ? 1 : 0), grade: (r) => r.h + r.a < 3 },
    { key: "o3.5", label: "Over 3.5 goals", w: (h, a) => (h + a > 3 ? 1 : 0), grade: (r) => r.h + r.a > 3 },
    { key: "btts", label: "Both teams score", w: (h, a) => (h > 0 && a > 0 ? 1 : 0), grade: (r) => r.h > 0 && r.a > 0 },
    { key: "nbtts", label: "Not both score", w: (h, a) => (h === 0 || a === 0 ? 1 : 0), grade: (r) => r.h === 0 || r.a === 0 },
    { key: "cs-h", label: `${H} clean sheet`, w: (_h, a) => (a === 0 ? 1 : 0), grade: (r) => r.a === 0 },
    { key: "cs-a", label: `${A} clean sheet`, w: (h) => (h === 0 ? 1 : 0), grade: (r) => r.h === 0 },
    { key: "ts-h", label: `${H} to score`, w: (h) => (h > 0 ? 1 : 0), grade: (r) => r.h > 0 },
    { key: "ts-a", label: `${A} to score`, w: (_h, a) => (a > 0 ? 1 : 0), grade: (r) => r.a > 0 },
  ];
  for (const pl of players) {
    const goals = (h, a) => (pl.side === "home" ? h : a);
    const surname = pl.name.split(" ").pop().toLowerCase();
    legs.push({
      key: `sc-${pl.side}-${surname}`,
      label: `${pl.name} to score`,
      w: (h, a) => 1 - Math.pow(1 - pl.share, goals(h, a)),
      grade: (r) => r.scorers[pl.side].some((n) => n.includes(surname)),
      scorer: true,
    });
  }
  return legs;
}

// --- 90' record from ESPN (for grading) ----------------------------------------

async function regulationRecord(espnId, homeName, awayName) {
  if (!espnId) return null;
  try {
    const j = await (
      await fetch(
        `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${espnId}`
      )
    ).json();
    const events = j.keyEvents ?? [];
    const rec = { h: 0, a: 0, scorers: { home: [], away: [] } };
    let sawGoalData = false;
    for (const e of events) {
      const t = (e.type?.type ?? "").toLowerCase();
      if (!t.startsWith("goal")) continue;
      sawGoalData = true;
      if ((e.period?.number ?? 1) > 2) continue; // ET goals don't count
      const own = /own goal/i.test(e.text ?? "");
      let side =
        e.team?.displayName === homeName ? "home"
        : e.team?.displayName === awayName ? "away"
        : null;
      if (!side) continue;
      if (own) side = side === "home" ? "away" : "home";
      if (side === "home") rec.h++;
      else rec.a++;
      if (!own) {
        const scorer = (e.participants?.[0]?.athlete?.displayName ?? "").toLowerCase();
        if (scorer) rec.scorers[side].push(scorer);
      }
    }
    // a 0-0 has no goal events — only trust the feed if the match summary loaded
    if (!j.header) return null;
    return rec;
  } catch {
    return null;
  }
}

// --- player shares (api-football top scorers) ------------------------------------

async function scorerShares() {
  if (!AF_KEY) return new Map();
  try {
    const j = await (
      await fetch(
        "https://v3.football.api-sports.io/players/topscorers?season=2026&league=1",
        { headers: { "x-apisports-key": AF_KEY } }
      )
    ).json();
    const out = new Map(); // team name (lower) -> [{name, share-ish gpg}]
    for (const r of j.response ?? []) {
      const s = r.statistics?.[0];
      const apps = s?.games?.appearences ?? 0;
      const goals = s?.goals?.total ?? 0;
      if (apps < 2 || goals < 2) continue;
      const team = (s?.team?.name ?? "").toLowerCase();
      (out.get(team) ?? out.set(team, []).get(team)).push({
        name: r.player?.name ?? "",
        gpg: goals / apps,
      });
    }
    return out;
  } catch {
    return new Map();
  }
}

// --- written analysis for each bet ----------------------------------------------

// The model explains its bet: quant context in, 2-3 sharp sentences out.
// Falls back to a numbers-only template when no key is configured.
async function explainBet(ctx) {
  const fallback =
    `Model prices ${ctx.label} at ${(ctx.pM * 100).toFixed(0)}% but the books' own 1X2 implies only ` +
    `${(ctx.pB * 100).toFixed(0)}% — model xG ${ctx.mxg} vs books-implied ${ctx.bxg}. ` +
    `At ${ctx.odds} that's +${(ctx.ev * 100).toFixed(0)}% EV; Kelly says ${(ctx.kelly * 100).toFixed(0)}% of bankroll.`;
  if (!ANTHROPIC_KEY) return { text: fallback, ai: false };
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey: ANTHROPIC_KEY });
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 400,
      thinking: { type: "adaptive" },
      system:
        "You are a football forecasting model explaining a bet you just placed with your own " +
        "bankroll. 2-3 sentences, first person, sharp and factual. Cite the key numbers from " +
        "the data. Explain WHERE the edge comes from (whose read differs and why the market " +
        "may be off). No hype, no hedging boilerplate, no disclaimers.",
      messages: [
        {
          role: "user",
          content:
            `Match: ${ctx.match}. Bet: ${ctx.label} at decimal odds ${ctx.odds}, stake $${ctx.stake}.
` +
            `My probability: ${(ctx.pM * 100).toFixed(1)}%. Books-implied probability for this market: ${(ctx.pB * 100).toFixed(1)}%.
` +
            `My expected goals: ${ctx.mxg}. Books-implied expected goals: ${ctx.bxg}.
` +
            `EV: +${(ctx.ev * 100).toFixed(0)}%. Full-Kelly fraction: ${(ctx.kelly * 100).toFixed(0)}%.
` +
            (ctx.combo ? `This is a same-match combo priced off my joint score grid (correlation included).
` : "") +
            `Write the analysis.`,
        },
      ],
    });
    const text = msg.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    return text ? { text, ai: true } : { text: fallback, ai: false };
  } catch (e) {
    console.log(`analysis fallback (${e?.message ?? e})`);
    return { text: fallback, ai: false };
  }
}

// =================================================================================

let state = { start: 1000, target: TARGET, cash: 1000, bets: [], log: [] };
try {
  state = JSON.parse(readFileSync(OUT, "utf8"));
} catch {}

const scores = await (await fetch(`${SITE}/api/scores`)).json();
const matches = scores.blend?.matches ?? [];
const now = new Date().toISOString();
const note = (msg) => {
  state.log.push({ at: now, msg });
  console.log(msg);
};

// --- settle -----------------------------------------------------------------------

for (const bet of state.bets.filter((b) => b.status === "open")) {
  const m = matches.find((x) => x.id === bet.matchId);
  if (!m || m.status !== "final" || !m.score) continue;

  let rec = await regulationRecord(m.espnId, m.home?.name, m.away?.name);
  if (!rec) {
    const extra = /aet|pen/i.test(m.live?.detail ?? "");
    if (bet.scorer) continue; // can't grade a scorer without the event feed — retry next run
    rec = extra
      ? { h: 0, a: 0, scorers: { home: [], away: [] } } // level at 90' — result-family only
      : { h: m.score.home, a: m.score.away, scorers: { home: [], away: [] } };
    if (extra && !["home", "away", "dc-1x", "dc-x2"].includes(bet.legs[0].key)) continue;
  }

  const menu = legMenu(m, bet.players ?? []);
  const won = bet.legs.every((l) => {
    const leg = menu.find((x) => x.key === l.key);
    return leg ? leg.grade(rec) : false;
  });

  bet.status = won ? "won" : "lost";
  bet.settledAt = now;
  bet.result = `${rec.h}-${rec.a} (90')`;
  if (won) {
    const ret = +(bet.stake * bet.odds).toFixed(2);
    bet.pnl = +(ret - bet.stake).toFixed(2);
    state.cash = +(state.cash + ret).toFixed(2);
    note(`WON ${bet.desc}: +$${bet.pnl} (bank $${state.cash})`);
  } else {
    bet.pnl = -bet.stake;
    note(`LOST ${bet.desc}: -$${bet.stake} (bank $${state.cash})`);
  }
}

// --- place ------------------------------------------------------------------------

const openBets = () => state.bets.filter((b) => b.status === "open");
const equity = () => state.cash + openBets().reduce((a, b) => a + b.stake, 0);

{
  if (equity() >= TARGET && !state.hitTarget) {
    state.hitTarget = true;
    note(`MILESTONE: equity $${equity().toFixed(2)} passed the $${TARGET} aim — compounding continues.`);
  }
  const bettable = matches.filter(
    (m) => m.status === "scheduled" && m.market && !state.bets.some((b) => b.matchId === m.id)
  );
  const shares = await scorerShares();

  for (const m of bettable) {
    if (state.cash < 5) break;
    const exposure = openBets().reduce((a, b) => a + b.stake, 0);
    if (exposure > equity() * EXPOSURE_CAP) {
      note(`exposure cap hit ($${exposure.toFixed(0)}) — holding fire`);
      break;
    }

    // model grid + books-implied grid
    const gm = grid(m.outcome.lambdaHome, m.outcome.lambdaAway);
    const fit = booksLambdas(m.market);
    if (!fit || fit.err > 0.003) continue; // books fit failed — don't trust derived prices
    const gb = grid(fit.lh, fit.la);

    // players for this match, share vs books-implied team goals-per-game
    const players = [];
    for (const [side, key] of [["home", m.home?.name], ["away", m.away?.name]]) {
      for (const pl of shares.get((key ?? "").toLowerCase()) ?? []) {
        const teamL = side === "home" ? fit.lh : fit.la;
        players.push({ name: pl.name, side, share: Math.min(0.6, pl.gpg / Math.max(1, teamL)) });
      }
    }

    const menu = legMenu(m, players);
    const single = (leg) => {
      const pM = gridProb(gm, leg.w);
      const pB = gridProb(gb, leg.w);
      if (pB <= 0.02 || pB >= 0.98) return null;
      const odds = +(1 + ((1 / pB) - 1) * MARGIN).toFixed(3);
      return { legs: [{ key: leg.key }], label: leg.label, pM, pB, odds, ev: pM * odds - 1 };
    };

    const candidates = [];
    for (const leg of menu) {
      const c = single(leg);
      if (c && c.ev >= EV_MIN) candidates.push(c);
    }
    // correlated combos: favourite x goals-flavoured legs (+ scorer variants)
    const favKey = m.outcome.pHome >= m.outcome.pAway ? "home" : "away";
    const fav = menu.find((l) => l.key === favKey);
    for (const other of menu.filter((l) =>
      ["o2.5", "btts", `ts-${favKey === "home" ? "h" : "a"}`].includes(l.key) || l.scorer
    )) {
      if (other.scorer && !other.key.includes(`-${favKey}-`)) continue;
      const w = (h, a) => fav.w(h, a) * other.w(h, a);
      const pM = gridProb(gm, w);
      const pB1 = gridProb(gb, fav.w);
      const pB2 = gridProb(gb, other.w);
      if (pB1 <= 0.03 || pB2 <= 0.03 || pM < 0.05) continue;
      const d1 = 1 + ((1 / pB1) - 1) * MARGIN;
      const d2 = 1 + ((1 / pB2) - 1) * MARGIN;
      const odds = +((1 + (d1 * d2 - 1) * COMBO_MARGIN)).toFixed(3);
      const ev = pM * odds - 1;
      if (ev >= EV_MIN)
        candidates.push({
          legs: [{ key: fav.key }, { key: other.key }],
          label: `${fav.label} + ${other.label}`,
          pM, pB: pB1 * pB2, odds, ev, scorer: other.scorer,
        });
    }
    if (!candidates.length) continue;

    // growth-optimal selection: quarter-Kelly EV per bet, best first
    candidates.sort((x, y) => y.ev - x.ev);
    const pick = candidates[0];

    const b = pick.odds - 1;
    const kelly = Math.max(0, (b * pick.pM - (1 - pick.pM)) / b);
    const frac = Math.min(STAKE_CAP, kelly * KELLY_FRACTION);
    const stake = +Math.min(state.cash, Math.max(5, equity() * frac)).toFixed(2);
    if (stake < 5 || stake > state.cash) continue;

    const explained = await explainBet({
      match: `${m.homeKey} v ${m.awayKey} (World Cup ${m.id.startsWith("qf") ? "quarter-final" : m.id.startsWith("sf") ? "semi-final" : m.id === "final" ? "final" : "knockout"})`,
      label: pick.label,
      odds: pick.odds,
      stake,
      pM: pick.pM,
      pB: pick.pB,
      mxg: `${m.outcome.lambdaHome.toFixed(1)}-${m.outcome.lambdaAway.toFixed(1)}`,
      bxg: `${fit.lh.toFixed(1)}-${fit.la.toFixed(1)}`,
      ev: pick.ev,
      kelly,
      combo: pick.legs.length > 1,
    });

    state.cash = +(state.cash - stake).toFixed(2);
    state.bets.push({
      analysis: explained.text,
      llm: explained.ai,
      matchId: m.id,
      placedAt: now,
      desc: `${pick.label} @ ${pick.odds} (${m.homeKey} v ${m.awayKey})`,
      legs: pick.legs,
      players: players.filter((p) => pick.legs.some((l) => l.key === `sc-${p.side}-${p.name.split(" ").pop().toLowerCase()}`)),
      scorer: !!pick.scorer,
      stake,
      odds: pick.odds,
      modelP: +pick.pM.toFixed(3),
      ev: +pick.ev.toFixed(3),
      status: "open",
    });
    note(
      `BET $${stake} on ${pick.label} @ ${pick.odds} — model ${(pick.pM * 100).toFixed(0)}%, EV +${(pick.ev * 100).toFixed(0)}%, ${(kelly * 100).toFixed(0)}% Kelly (bank $${state.cash})`
    );
  }
}

// Backfill: rewrite template analyses with the model's own words once the
// key is available (state races with the cron can leave fallbacks behind).
if (ANTHROPIC_KEY) {
  for (const bet of state.bets.filter((b) => b.status === "open" && !b.llm)) {
    const m = matches.find((x) => x.id === bet.matchId);
    if (!m || !m.market || m.status !== "scheduled") continue;
    const gm = grid(m.outcome.lambdaHome, m.outcome.lambdaAway);
    const fit = booksLambdas(m.market);
    if (!fit) continue;
    const gb = grid(fit.lh, fit.la);
    const menu = legMenu(m, bet.players ?? []);
    const legs = bet.legs.map((l) => menu.find((x) => x.key === l.key)).filter(Boolean);
    if (legs.length !== bet.legs.length) continue;
    const w = (h, a) => legs.reduce((acc, L) => acc * L.w(h, a), 1);
    const pM = gridProb(gm, w);
    const pB =
      legs.length > 1
        ? legs.reduce((acc, L) => acc * gridProb(gb, L.w), 1)
        : gridProb(gb, w);
    const explained = await explainBet({
      match: `${m.homeKey} v ${m.awayKey}`,
      label: bet.desc.replace(/ @ .*/, ""),
      odds: bet.odds,
      stake: bet.stake,
      pM,
      pB,
      mxg: `${m.outcome.lambdaHome.toFixed(1)}-${m.outcome.lambdaAway.toFixed(1)}`,
      bxg: `${fit.lh.toFixed(1)}-${fit.la.toFixed(1)}`,
      ev: bet.ev ?? pM * bet.odds - 1,
      kelly: Math.max(0, ((bet.odds - 1) * pM - (1 - pM)) / (bet.odds - 1)),
      combo: bet.legs.length > 1,
    });
    if (explained.ai) {
      bet.analysis = explained.text;
      bet.llm = true;
      note(`analysis written for: ${bet.desc}`);
    }
  }
}

state.log = state.log.slice(-300);
writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n");
const open = openBets();
console.log(
  `bankroll: $${state.cash} cash, $${open.reduce((a, b) => a + b.stake, 0).toFixed(2)} in ${open.length} open bet(s), equity $${equity().toFixed(2)} / target $${TARGET}`
);
