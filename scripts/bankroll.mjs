// Paper bankroll: the model bets a virtual $100 until the end of the World
// Cup. Runs in the ledger cron. Strategy: for each upcoming match with book
// odds, find the result-family outcome (win or double-chance) where the
// blend's probability beats the de-vigged books by >= EDGE_MIN; stake
// quarter-Kelly capped at 15% of bankroll. Offered odds are the de-vigged
// book price with a 3% payout haircut to simulate real margin. One bet per
// match. 90' results grade bets: a knockout that reached ET/pens was a draw
// at 90' by definition.

import { readFileSync, writeFileSync } from "node:fs";

const SITE = process.env.SITE_URL ?? "https://consensus-football.vercel.app";
const OUT = new URL("../data/bankroll.json", import.meta.url);
const EDGE_MIN = 0.05;
const KELLY_FRACTION = 0.25;
const STAKE_CAP = 0.15; // of current bankroll
const MARGIN = 0.97; // payout haircut vs de-vigged fair books price

let state = { start: 100, cash: 100, bets: [], log: [] };
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

// --- settle finished bets ------------------------------------------------------

for (const bet of state.bets.filter((b) => b.status === "open")) {
  const m = matches.find((x) => x.id === bet.matchId);
  if (!m) continue;
  if (m.status !== "final" || !m.score) continue;

  // 90' result: ET/pens implies the 90 minutes ended level
  const extra = /aet|pen/i.test(m.live?.detail ?? "");
  const res = extra
    ? "draw"
    : m.score.home > m.score.away
    ? "home"
    : m.score.home < m.score.away
    ? "away"
    : "draw";
  const won =
    bet.pick === res ||
    (bet.pick === "dc-1x" && res !== "away") ||
    (bet.pick === "dc-x2" && res !== "home");

  bet.status = won ? "won" : "lost";
  bet.settledAt = now;
  bet.result = `${m.score.home}-${m.score.away}${extra ? " (aet/pens)" : ""}`;
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

// --- place new bets -------------------------------------------------------------

for (const m of matches) {
  if (m.status !== "scheduled" || !m.market) continue;
  if (state.bets.some((b) => b.matchId === m.id)) continue;

  const model = { home: m.outcome.pHome, draw: m.outcome.pDraw, away: m.outcome.pAway };
  const books = { home: m.market.pHome, draw: m.market.pDraw, away: m.market.pAway };
  const candidates = [
    { pick: "home", label: `${m.homeKey} win`, p: model.home, bp: books.home },
    { pick: "away", label: `${m.awayKey} win`, p: model.away, bp: books.away },
    { pick: "dc-1x", label: `${m.homeKey} or draw`, p: model.home + model.draw, bp: books.home + books.draw },
    { pick: "dc-x2", label: `${m.awayKey} or draw`, p: model.away + model.draw, bp: books.away + books.draw },
  ];

  let best = null;
  for (const c of candidates) {
    const edge = c.p - c.bp;
    if (edge >= EDGE_MIN && (!best || edge > best.edge)) best = { ...c, edge };
  }
  if (!best) continue;

  const odds = +(((1 / best.bp) - 1) * MARGIN + 1).toFixed(3); // margin on the win part
  const b = odds - 1;
  const kelly = (b * best.p - (1 - best.p)) / b;
  const stake = +Math.min(
    state.cash * STAKE_CAP,
    Math.max(1, state.cash * kelly * KELLY_FRACTION)
  ).toFixed(2);
  if (stake > state.cash || stake < 1 || kelly <= 0) continue;

  state.cash = +(state.cash - stake).toFixed(2);
  state.bets.push({
    matchId: m.id,
    placedAt: now,
    desc: `${best.label} @ ${odds} (${m.homeKey} v ${m.awayKey})`,
    pick: best.pick,
    stake,
    odds,
    edge: +best.edge.toFixed(3),
    modelP: +best.p.toFixed(3),
    booksP: +best.bp.toFixed(3),
    status: "open",
  });
  note(
    `BET $${stake} on ${best.label} @ ${odds} — model ${(best.p * 100).toFixed(0)}% vs books ${(best.bp * 100).toFixed(0)}% (bank $${state.cash})`
  );
}

state.log = state.log.slice(-200);
writeFileSync(OUT, JSON.stringify(state, null, 2) + "\n");
const open = state.bets.filter((b) => b.status === "open");
const exposure = open.reduce((a, b) => a + b.stake, 0);
console.log(
  `bankroll: $${state.cash} cash, $${exposure.toFixed(2)} in ${open.length} open bet(s), equity $${(state.cash + exposure).toFixed(2)}`
);
