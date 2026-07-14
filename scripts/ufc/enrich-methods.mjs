// Backfill the finish method for every completed bout → data/methods.json {boutId: resultName}.
// The scoreboard omits methods; only the per-bout core status has them (result.name:
// "kotko" | "submission" | "decision---unanimous/split/majority" | dq/no-contest variants).
// ~9.2k requests on the first run, then incremental — the cron only sees ~14 new bouts a week.
//
// Usage: node scripts/enrich-methods.mjs

import { readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../../data/ufc/methods.json", import.meta.url);
const CONCURRENCY = 6;

const fights = JSON.parse(readFileSync(new URL("../../data/ufc/fights.json", import.meta.url), "utf8"));
let methods = {};
try {
  methods = JSON.parse(readFileSync(OUT, "utf8"));
} catch {}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchMethod(f) {
  const url = `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${f.eventId}/competitions/${f.boutId}/status?lang=en&region=us`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return "unknown";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return d.result?.name ?? "unknown";
    } catch (err) {
      if (attempt === 3) {
        console.error(`  ${f.boutId}: ${err.message}`);
        return null; // retried next run
      }
      await sleep(1200 * attempt);
    }
  }
}

async function main() {
  const todo = fights.filter((f) => !(f.boutId in methods));
  console.log(`${fights.length} bouts, ${todo.length} to enrich`);

  let done = 0;
  let i = 0;
  async function worker() {
    while (i < todo.length) {
      const f = todo[i++];
      const m = await fetchMethod(f);
      if (m !== null) methods[f.boutId] = m;
      done++;
      if (done % 200 === 0) {
        writeFileSync(OUT, JSON.stringify(methods));
        console.log(`  ${done}/${todo.length}`);
      }
      await sleep(40);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  writeFileSync(OUT, JSON.stringify(methods));
  const counts = {};
  for (const m of Object.values(methods)) counts[m] = (counts[m] ?? 0) + 1;
  console.log(`wrote ${Object.keys(methods).length} methods:`, JSON.stringify(counts));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
