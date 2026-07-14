// The paper bankroll: $1,000 of simulated money bet at real average book prices,
// committed to git every run. Probabilities are the CONSENSUS (50/50 model+de-vigged
// books) — our best-calibrated estimate — so a bet only fires when the model's
// disagreement is large enough that half of it still clears the vig. Quarter-Kelly
// stakes (growth-optimal, quartered for estimation error), fights with a near-debut
// fighter skipped (the model's known blind spot), 25% exposure cap per event.
// Singles on moneylines and rounds totals; one parlay per card from the best +EV legs.
//
// Runs in the data cron: place → settle → commit. Usage: node scripts/bankroll.mjs

import { readFileSync, writeFileSync } from "node:fs";

const STATE = new URL("../../data/ufc/bankroll.json", import.meta.url);
const MIN_EV = 0.03; // 3% expected value or it's a pass
const KELLY_FRACTION = 0.75; // three-quarter Kelly — max aggression that's still a strategy
const MAX_STAKE_FRac = 0.15; // singles cap: 15% of bankroll
const MAX_PARLAY_FRAC = 0.08;
const MIN_STAKE = 50; // owner mandate: no bet under $50
const MIN_LEAD_MS = 30 * 60e3; // don't bet fights starting within 30 minutes
const MIN_UFC_FIGHTS = 3; // skip near-debuts — the model's blind spot
const MAX_EVENT_EXPOSURE = 1.0; // owner mandate: no event cap
const LOCK_P = 0.7; // locks (≥70% consensus) size at FULL Kelly, uncapped

const read = (p) => JSON.parse(readFileSync(new URL(`../../data/ufc/${p}`, import.meta.url), "utf8"));
const forecasts = read("forecasts.json");
const fightsHist = read("fights.json");
const odds = read("odds.json").byBout;

let state;
try {
  state = JSON.parse(readFileSync(STATE, "utf8"));
} catch {
  state = { start: 1000, cash: 1000, open: [], settled: [], curve: [] };
}

// Given a finish, share of finishes per round (modern era; 5R tail stretched).
const R3 = { 1: 0.505, 2: 0.326, 3: 0.169 };
const R5 = { 1: 0.44, 2: 0.28, 3: 0.15, 4: 0.08, 5: 0.05 };

// P(fight duration in rounds > point): decisions always exceed any posted point;
// a finish in round r is uniform within the round.
function pOver(point, method, fiveRounds) {
  const dist = fiveRounds ? R5 : R3;
  const finish = method.ko + method.sub;
  let p = method.dec;
  for (const [r, share] of Object.entries(dist)) {
    p += finish * share * Math.max(0, Math.min(1, Number(r) - point));
  }
  return p;
}

function kellyStake(p, price, bankroll, cap) {
  const edge = p * price - 1;
  if (edge <= 0) return 0;
  const kelly = edge / (price - 1);
  if (p >= LOCK_P) return bankroll * kelly; // lock: full Kelly, no cap — the splurge that still compounds
  return Math.min(bankroll * cap, Math.max(MIN_STAKE, bankroll * kelly * KELLY_FRACTION));
}

const now = Date.now();
const lastLabel = (n) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");

// ESPN stamps every bout with the CARD start time, so a listed time in the past means
// nothing for late fights. The scoreboard's live state is the truth: bet only "pre".
const liveState = new Map();
try {
  const sb = await fetch("https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard").then((r) => r.json());
  for (const ev of sb?.events ?? []) {
    for (const c of ev.competitions ?? []) {
      liveState.set(String(c.id), c.status?.type?.state ?? "pre");
    }
  }
} catch {}

const bettable = (f) => {
  const st = liveState.get(String(f.boutId));
  if (st) return st === "pre";
  return new Date(f.date).getTime() > now + MIN_LEAD_MS;
};

// ---- settle open bets ----
const resultByBout = new Map(fightsHist.map((f) => [f.boutId, f]));
const stillOpen = [];
for (const bet of state.open) {
  const legsResolved = bet.legs.map((leg) => {
    const r = resultByBout.get(leg.boutId);
    if (!r) return null;
    if (r.winnerId === null) return "void";
    if (leg.type === "ml") return String(r.winnerId) === String(leg.pickId) ? "win" : "lose";
    // totals: duration in rounds = (round-1) + minutes/5; decisions ran the full clock.
    const [mm, ss] = (r.clock ?? "5:00").split(":").map(Number);
    const duration = (r.round ?? 3) - 1 + (mm + (ss || 0) / 60) / 5;
    const over = duration > leg.point;
    return (leg.side === "over") === over ? "win" : "lose";
  });
  if (legsResolved.some((x) => x === null)) {
    stillOpen.push(bet);
    continue;
  }
  const voided = legsResolved.every((x) => x === "void");
  const won = !voided && legsResolved.every((x) => x === "win" || x === "void");
  const effPrice = voided ? 1 : bet.legs.reduce((s, leg, i) => (legsResolved[i] === "void" ? s : s * leg.price), 1);
  const payout = won || voided ? Math.round(bet.stake * effPrice * 100) / 100 : 0;
  state.cash = Math.round((state.cash + payout) * 100) / 100;
  state.settled.push({ ...bet, settledAt: new Date().toISOString(), outcome: voided ? "void" : won ? "win" : "loss", payout });
  console.log(`settled ${bet.kind} "${bet.title}" → ${voided ? "VOID" : won ? "WIN" : "LOSS"} ${won ? `+$${(payout - bet.stake).toFixed(2)}` : `−$${bet.stake}`}`);
}
state.open = stillOpen;

// ---- find candidate bets ----
// Existing stake per market: candidates aren't blocked by an open position — the sizer
// tops up to the current Kelly target instead (matters when caps rise or bankroll grows).
const existingStake = new Map();
for (const b of state.open) {
  if (b.kind !== "single") continue;
  const l = b.legs[0];
  const k = `${l.boutId}:${l.type}`;
  existingStake.set(k, (existingStake.get(k) ?? 0) + b.stake);
}
const openKeys = { has: () => false }; // superseded by top-up sizing
const candidates = [];
for (const card of forecasts.cards) {
  for (const f of card.fights) {
    const o = odds[f.boutId];
    if (!o || !f.method) continue;
    if (!bettable(f)) continue;
    if (resultByBout.has(f.boutId)) continue;
    if (Math.min(f.fightsA ?? 0, f.fightsB ?? 0) < MIN_UFC_FIGHTS) continue;
    const fiveR = f.matchNumber === 1;
    const consPA = (f.pA + o.pA) / 2; // consensus win prob for A
    const mk = (leg, p, title, analysis) => candidates.push({ ...leg, p, title, analysis, event: card.name });

    if (o.priceA && !openKeys.has(`${f.boutId}:ml`)) {
      mk({ boutId: f.boutId, type: "ml", pickId: String(f.a.id), price: o.priceA, label: `${lastLabel(f.a.name)} ML` },
        consPA, `${lastLabel(f.a.name)} ML @ ${o.priceA}`,
        `consensus ${(consPA * 100).toFixed(1)}% (model ${(f.pA * 100).toFixed(1)}) vs implied ${(100 / o.priceA).toFixed(1)}%`);
      mk({ boutId: f.boutId, type: "ml", pickId: String(f.b.id), price: o.priceB, label: `${lastLabel(f.b.name)} ML` },
        1 - consPA, `${lastLabel(f.b.name)} ML @ ${o.priceB}`,
        `consensus ${((1 - consPA) * 100).toFixed(1)}% (model ${((1 - f.pA) * 100).toFixed(1)}) vs implied ${(100 / o.priceB).toFixed(1)}%`);
    }
    for (const t of o.totals ?? []) {
      if (openKeys.has(`${f.boutId}:total`)) continue;
      const overModel = pOver(t.point, f.method, fiveR);
      const overImplied = (1 / t.over) / (1 / t.over + 1 / t.under);
      const over = (overModel + overImplied) / 2; // consensus, same philosophy as moneylines
      mk({ boutId: f.boutId, type: "total", point: t.point, side: "over", price: t.over, label: `Over ${t.point} rds` },
        over, `${lastLabel(f.a.name)}-${lastLabel(f.b.name)} Over ${t.point} @ ${t.over}`,
        `model P(over)=${(over * 100).toFixed(1)}% vs implied ${(100 / t.over).toFixed(1)}% (dec ${(f.method.dec * 100).toFixed(0)}%)`);
      mk({ boutId: f.boutId, type: "total", point: t.point, side: "under", price: t.under, label: `Under ${t.point} rds` },
        1 - over, `${lastLabel(f.a.name)}-${lastLabel(f.b.name)} Under ${t.point} @ ${t.under}`,
        `model P(under)=${((1 - over) * 100).toFixed(1)}% vs implied ${(100 / t.under).toFixed(1)}% (finish ${((f.method.ko + f.method.sub) * 100).toFixed(0)}%)`);
    }
  }
}

// ---- place singles ----
let placed = 0;
const placedBouts = new Set();
const eventExposure = new Map();
for (const b of state.open) eventExposure.set(b.event, (eventExposure.get(b.event) ?? 0) + b.stake);
const bankrollNow = state.cash + state.open.reduce((s, b) => s + b.stake, 0);
for (const c of candidates.sort((x, y) => y.p * y.price - x.p * x.price)) {
  const ev = c.p * c.price - 1;
  if (ev < MIN_EV || placedBouts.has(c.boutId)) continue;
  const held = existingStake.get(`${c.boutId}:${c.type}`) ?? 0;
  const target = kellyStake(c.p, c.price, state.cash + held, MAX_STAKE_FRac);
  const stake = Math.round(Math.max(0, target - held) * 100) / 100;
  if (stake < MIN_STAKE || stake > state.cash) continue;
  if ((eventExposure.get(c.event) ?? 0) + stake > bankrollNow * MAX_EVENT_EXPOSURE) continue;
  eventExposure.set(c.event, (eventExposure.get(c.event) ?? 0) + stake);
  state.cash = Math.round((state.cash - stake) * 100) / 100;
  placedBouts.add(c.boutId);
  state.open.push({
    kind: "single",
    title: (existingStake.get(`${c.boutId}:${c.type}`) ?? 0) > 0 ? `${c.title} (top-up)` : c.title,
    legs: [{ boutId: c.boutId, type: c.type, pickId: c.pickId, point: c.point, side: c.side, price: c.price, label: c.label }],
    stake,
    price: c.price,
    p: Math.round(c.p * 1000) / 1000,
    ev: Math.round(ev * 1000) / 1000,
    event: c.event,
    analysis: c.analysis,
    placedAt: new Date().toISOString(),
  });
  placed++;
  console.log(`bet $${stake} on ${c.title} (EV +${(ev * 100).toFixed(1)}%)`);
}

// ---- one parlay per card from the top +EV legs on distinct bouts ----
const byEvent = new Map();
for (const c of candidates) {
  const ev = c.p * c.price - 1;
  if (ev < MIN_EV) continue;
  if (!byEvent.has(c.event)) byEvent.set(c.event, []);
  byEvent.get(c.event).push({ ...c, ev });
}
for (const [event, list] of byEvent) {
  const parlayKey = `parlay:${event}`;
  if (state.open.some((b) => b.kind === "parlay" && b.event === event)) continue;
  const legs = [];
  for (const c of list.sort((x, y) => y.ev - x.ev)) {
    if (legs.some((l) => l.boutId === c.boutId)) continue;
    legs.push(c);
    if (legs.length === 3) break;
  }
  if (legs.length < 2) continue;
  const p = legs.reduce((s, l) => s * l.p, 1);
  const price = Math.round(legs.reduce((s, l) => s * l.price, 1) * 100) / 100;
  const ev = p * price - 1;
  if (ev < MIN_EV) continue;
  const stake = Math.round(kellyStake(p, price, state.cash, MAX_PARLAY_FRAC) * 100) / 100;
  if (stake < MIN_STAKE || stake > state.cash) continue;
  state.cash = Math.round((state.cash - stake) * 100) / 100;
  state.open.push({
    kind: "parlay",
    title: `${legs.length}-leg parlay @ ${price}: ${legs.map((l) => l.label).join(" + ")}`,
    legs: legs.map((c) => ({ boutId: c.boutId, type: c.type, pickId: c.pickId, point: c.point, side: c.side, price: c.price, label: c.label })),
    stake,
    price,
    p: Math.round(p * 1000) / 1000,
    ev: Math.round(ev * 1000) / 1000,
    event,
    analysis: legs.map((l) => l.analysis).join(" · "),
    placedAt: new Date().toISOString(),
  });
  placed++;
  console.log(`parlay $${stake} @ ${price} on ${event} (EV +${(ev * 100).toFixed(1)}%)`);
}

const exposure = state.open.reduce((s, b) => s + b.stake, 0);
state.curve.push({ at: new Date().toISOString(), cash: state.cash, exposure: Math.round(exposure * 100) / 100 });
if (state.curve.length > 2000) state.curve = state.curve.slice(-2000);
writeFileSync(STATE, JSON.stringify(state, null, 1));
console.log(
  `bankroll: $${state.cash.toFixed(2)} cash + $${exposure.toFixed(2)} in ${state.open.length} open bets (placed ${placed} this run, ${state.settled.length} settled all-time)`
);
