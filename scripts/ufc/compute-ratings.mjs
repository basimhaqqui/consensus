// Replay the full fight history with the backtest-validated constants and write:
//   data/ratings.json   — current Elo per fighter (with record, last fight, age)
//   data/forecasts.json — model win probability for every fight on upcoming cards
//
// Constants live in backtest.mjs DEFAULT — change them there, re-validate, then re-run this.
//
// Usage: node scripts/compute-ratings.mjs

import { readFileSync, writeFileSync } from "node:fs";
import { DEFAULT } from "./backtest.mjs";
import { buildMethodModel, METHOD_DEFAULT } from "./method-model.mjs";

const fights = JSON.parse(readFileSync(new URL("../../data/ufc/fights.json", import.meta.url), "utf8"));
let fighters = {};
try {
  fighters = JSON.parse(readFileSync(new URL("../../data/ufc/fighters.json", import.meta.url), "utf8"));
} catch {}
let upcoming = { cards: [] };
try {
  upcoming = JSON.parse(readFileSync(new URL("../../data/ufc/upcoming.json", import.meta.url), "utf8"));
} catch {}
let methods = {};
try {
  methods = JSON.parse(readFileSync(new URL("../../data/ufc/methods.json", import.meta.url), "utf8"));
} catch {}

const BASE_RATING = 1500;
const cfg = DEFAULT;

// Debut prior: net pre-UFC wins (career record minus UFC record), mirrors backtest.mjs.
const ufcTot = new Map();
for (const f of fights) {
  if (f.winnerId === null) continue;
  for (const [id, won] of [[String(f.a.id), f.winnerId === f.a.id], [String(f.b.id), f.winnerId === f.b.id]]) {
    const t = ufcTot.get(id) ?? { w: 0, l: 0 };
    if (won) t.w++;
    else t.l++;
    ufcTot.set(id, t);
  }
}
function preNet(id) {
  const m = fighters[id]?.proRecord?.match(/^(\d+)-(\d+)/);
  if (!m) return 0;
  const t = ufcTot.get(id) ?? { w: 0, l: 0 };
  return Math.max(-15, Math.min(15, Math.max(0, +m[1] - t.w) - Math.max(0, +m[2] - t.l)));
}

const rating = new Map();
const count = new Map();
const wins = new Map();
const lastDate = new Map();
const names = new Map();
const history = new Map(); // id -> [[epochDay, postFightRating], ...]
const get = (id) => rating.get(id) ?? BASE_RATING + (cfg.priorCoef ?? 0) * preNet(id);

function applyLayoff(id, t) {
  const last = lastDate.get(id);
  if (last && cfg.layoffRho > 0) {
    const idleYears = (t - last) / (365.25 * 864e5) - 1;
    if (idleYears > 0) {
      const keep = Math.max(0, 1 - cfg.layoffRho * idleYears);
      rating.set(id, BASE_RATING + (get(id) - BASE_RATING) * keep);
    }
  }
}

function ageAt(id, dateISO) {
  const dob = fighters[String(id)]?.dob;
  if (!dob) return null;
  return (new Date(dateISO) - new Date(dob)) / (365.25 * 864e5);
}

function adjusted(id, dateISO) {
  let r = get(id);
  if (cfg.agePenalty > 0) {
    const a = ageAt(id, dateISO);
    if (a !== null) r -= cfg.agePenalty * Math.max(0, a - cfg.ageKnee);
  }
  return r;
}

for (const f of fights) {
  if (f.winnerId === null) continue;
  const [ia, ib] = [String(f.a.id), String(f.b.id)];
  const t = new Date(f.date);
  applyLayoff(ia, t);
  applyLayoff(ib, t);
  const kOf = (id) => cfg.k * ((count.get(id) ?? 0) < cfg.provFights ? cfg.provMult : 1);
  const mult = f.decision ? 1 : cfg.finishMult;
  const exp = 1 / (1 + 10 ** (-(get(ia) - get(ib)) / 400));
  const aWon = f.winnerId === f.a.id;
  const err = (aWon ? 1 : 0) - exp;
  rating.set(ia, get(ia) + kOf(ia) * mult * err);
  rating.set(ib, get(ib) - kOf(ib) * mult * err);
  const day = Math.floor(t.getTime() / 864e5);
  for (const [id, nm, won] of [[ia, f.a.name, aWon], [ib, f.b.name, !aWon]]) {
    count.set(id, (count.get(id) ?? 0) + 1);
    if (won) wins.set(id, (wins.get(id) ?? 0) + 1);
    lastDate.set(id, t);
    names.set(id, nm);
    if (!history.has(id)) history.set(id, []);
    history.get(id).push([day, Math.round(get(id))]);
  }
}

const nowISO = new Date().toISOString();

// Division = weight class of the most recent fight (P4P rows show it).
const division = new Map();
for (const f of fights) {
  for (const id of [String(f.a.id), String(f.b.id)]) {
    if (f.weightClass) division.set(id, f.weightClass);
  }
}

// P4P rating: current Elo decayed for time on the shelf (same layoffRho as forecasts).
// Deliberately NO age term — the age curve is a forecast adjustment ("older fighters
// underperform their rating next fight"), and applying it to a board just ranks the
// elite by birthday. On the board, age counts when it costs you a fight.
const now = new Date(nowISO);
function p4pOf(id) {
  let r = get(id);
  const last = lastDate.get(id);
  if (last) {
    const idleYears = (now - last) / (365.25 * 864e5) - 1;
    if (idleYears > 0) r = BASE_RATING + (r - BASE_RATING) * Math.max(0, 1 - cfg.layoffRho * idleYears);
  }
  return r;
}

const out = {};
for (const [id, r] of rating) {
  out[id] = {
    name: names.get(id),
    rating: Math.round(r * 10) / 10,
    p4p: Math.round(p4pOf(id) * 10) / 10,
    division: division.get(id) ?? null,
    fights: count.get(id) ?? 0,
    wins: wins.get(id) ?? 0,
    lastFight: lastDate.get(id)?.toISOString().slice(0, 10) ?? null,
  };
}
writeFileSync(new URL("../../data/ufc/ratings.json", import.meta.url), JSON.stringify({ computedAt: nowISO, config: cfg, ratings: out }, null, 1));
writeFileSync(new URL("../../data/ufc/history.json", import.meta.url), JSON.stringify(Object.fromEntries(history)));

const methodModel = buildMethodModel(fights, methods, METHOD_DEFAULT);

const forecasts = upcoming.cards.map((card) => ({
  eventId: card.eventId,
  name: card.name,
  date: card.date,
  fights: card.fights.map((ft) => {
    const [ia, ib] = [String(ft.a.id), String(ft.b.id)];
    // Layoff applies at forecast time too — a returning fighter is rated stale.
    applyLayoff(ia, new Date(ft.date));
    applyLayoff(ib, new Date(ft.date));
    const [ra, rb] = [adjusted(ia, ft.date), adjusted(ib, ft.date)];
    const p = 1 / (1 + 10 ** (-(ra - rb) / cfg.scale));
    const m = Object.keys(methods).length ? methodModel.predict(ia, ib, ft.weightClass) : null;
    return {
      ...ft,
      ratingA: Math.round(ra),
      ratingB: Math.round(rb),
      pA: Math.round(p * 1000) / 1000,
      fightsA: count.get(ia) ?? 0,
      fightsB: count.get(ib) ?? 0,
      method: m && { ko: Math.round(m.ko * 100) / 100, sub: Math.round(m.sub * 100) / 100, dec: Math.round(m.dec * 100) / 100 },
    };
  }),
}));
writeFileSync(new URL("../../data/ufc/forecasts.json", import.meta.url), JSON.stringify({ computedAt: nowISO, cards: forecasts }, null, 1));

const top = Object.values(out)
  .filter((f) => f.fights >= 5 && f.lastFight >= "2024-07-01")
  .sort((a, b) => b.rating - a.rating)
  .slice(0, 15);
console.log("top 15 active fighters:");
for (const f of top) console.log(`  ${String(f.rating).padStart(7)}  ${f.name}  (${f.wins}-${f.fights - f.wins}, last ${f.lastFight})`);
console.log(`\nwrote ratings for ${Object.keys(out).length} fighters + forecasts for ${forecasts.length} cards`);
