// Pull all completed UFC bouts from ESPN's public scoreboard API into data/fights.json.
// Date-range scoreboard queries inline every bout (winner, weight class, ending round/clock),
// so the full 1993→today history is ~70 requests. Incremental: re-pulls only from the last
// event date forward (cards churn constantly, so the trailing window is always refreshed).
//
// Usage: node scripts/scrape-fights.mjs [--full]

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = new URL("../../data/ufc/fights.json", import.meta.url);
const BASE = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const START_YEAR = 1993;
const DELAY_MS = 250;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRange(from, to) {
  const url = `${BASE}?dates=${from}-${to}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()).events ?? [];
    } catch (err) {
      if (attempt === 3) throw new Error(`${url}: ${err.message}`);
      await sleep(1000 * attempt);
    }
  }
}

// ESPN 500s on a few historical windows; bisect down to single months and skip only those.
async function fetchRangeSafe(from, to) {
  try {
    return await fetchRange(from, to);
  } catch (err) {
    const [y1, m1] = [+from.slice(0, 4), +from.slice(4, 6)];
    const [y2, m2] = [+to.slice(0, 4), +to.slice(4, 6)];
    const months = (y2 - y1) * 12 + (m2 - m1);
    if (months === 0) {
      console.warn(`  SKIP ${from}-${to}: ${err.message}`);
      return [];
    }
    const midIdx = y1 * 12 + (m1 - 1) + Math.floor(months / 2);
    const [my, mm] = [Math.floor(midIdx / 12), (midIdx % 12) + 1];
    const midEnd = `${my}${String(mm).padStart(2, "0")}${new Date(Date.UTC(my, mm, 0)).getUTCDate()}`;
    const nextIdx = midIdx + 1;
    const [ny, nm] = [Math.floor(nextIdx / 12), (nextIdx % 12) + 1];
    const midStart = `${ny}${String(nm).padStart(2, "0")}01`;
    await sleep(DELAY_MS);
    const left = await fetchRangeSafe(from, midEnd);
    await sleep(DELAY_MS);
    const right = await fetchRangeSafe(midStart, to);
    return [...left, ...right];
  }
}

function parseEvent(ev) {
  const fights = [];
  for (const c of ev.competitions ?? []) {
    const st = c.status ?? {};
    if (st.type?.name !== "STATUS_FINAL" || !st.type?.completed) continue;
    const comps = c.competitors ?? [];
    if (comps.length !== 2) continue;
    const [a, b] = comps;
    const fighter = (x) => ({ id: x.athlete?.id ?? x.id, name: x.athlete?.displayName ?? "" });
    const winner = a.winner ? fighter(a).id : b.winner ? fighter(b).id : null;
    const round = st.period ?? null;
    const clock = st.displayClock ?? null;
    fights.push({
      eventId: ev.id,
      eventName: ev.name,
      date: c.date ?? ev.date,
      boutId: c.id,
      weightClass: c.type?.abbreviation ?? null,
      a: fighter(a),
      b: fighter(b),
      winnerId: winner, // null = draw or no contest
      round,
      clock,
      // decision = went the scheduled distance (final round ended at 5:00)
      decision: clock === "5:00",
    });
  }
  return fights;
}

async function main() {
  const full = process.argv.includes("--full");
  let existing = [];
  if (!full) {
    try {
      existing = JSON.parse(readFileSync(OUT, "utf8"));
    } catch {}
  }

  // Resume from the month of the last stored fight (re-pull it: late grades/corrections).
  let startYear = START_YEAR;
  let startMonth = 1;
  if (existing.length) {
    const last = existing.map((f) => f.date).sort().at(-1);
    const d = new Date(last);
    startYear = d.getUTCFullYear();
    startMonth = d.getUTCMonth() + 1;
    existing = existing.filter((f) => {
      const fd = new Date(f.date);
      return fd.getUTCFullYear() < startYear || (fd.getUTCFullYear() === startYear && fd.getUTCMonth() + 1 < startMonth);
    });
  }

  const now = new Date();
  const fights = [...existing];
  const seen = new Set(fights.map((f) => f.boutId));

  // Half-year chunks keep each response comfortably under any event cap.
  for (let y = startYear; y <= now.getUTCFullYear(); y++) {
    for (const [m1, m2, lastDay] of [[1, 6, 30], [7, 12, 31]]) {
      if (y === startYear && m2 < startMonth) continue;
      if (y === now.getUTCFullYear() && m1 > now.getUTCMonth() + 1) continue;
      const from = `${y}${String(m1).padStart(2, "0")}01`;
      const to = `${y}${String(m2).padStart(2, "0")}${lastDay}`;
      const events = await fetchRangeSafe(from, to);
      let added = 0;
      for (const ev of events) {
        for (const f of parseEvent(ev)) {
          if (seen.has(f.boutId)) continue;
          seen.add(f.boutId);
          fights.push(f);
          added++;
        }
      }
      console.log(`${y} H${m1 === 1 ? 1 : 2}: ${events.length} events, +${added} fights (total ${fights.length})`);
      await sleep(DELAY_MS);
    }
  }

  fights.sort((x, y2) => x.date.localeCompare(y2.date));
  mkdirSync(new URL("../../data/ufc/", import.meta.url), { recursive: true });
  writeFileSync(OUT, JSON.stringify(fights, null, 1));
  console.log(`wrote ${fights.length} fights to data/ufc/fights.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
