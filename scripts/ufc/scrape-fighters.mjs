// Pull fighter bios (DOB, height, reach, stance) from ESPN's core athlete API for every
// fighter id that appears in data/fights.json → data/fighters.json. Incremental: skips ids
// already stored. ~2,600 fighters on a full run; safe to re-run any time.
//
// Usage: node scripts/scrape-fighters.mjs

import { readFileSync, writeFileSync } from "node:fs";

const FIGHTS = new URL("../../data/ufc/fights.json", import.meta.url);
const OUT = new URL("../../data/ufc/fighters.json", import.meta.url);
const DELAY_MS = 120;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url, id) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (attempt === 3) {
        console.error(`  ${id}: ${err.message}`);
        return null;
      }
      await sleep(1500 * attempt);
    }
  }
}

const fetchAthlete = (id) =>
  fetchJson(`https://sports.core.api.espn.com/v2/sports/mma/athletes/${id}?lang=en&region=us`, id);

// Career pro record ("27-9-0") — the raw material for debut priors.
async function fetchProRecord(id) {
  const d = await fetchJson(`https://sports.core.api.espn.com/v2/sports/mma/athletes/${id}/records?lang=en&region=us`, id);
  const overall = d?.items?.find((r) => r?.type === "total") ?? d?.items?.[0];
  return overall?.summary ?? null;
}

async function main() {
  const fights = JSON.parse(readFileSync(FIGHTS, "utf8"));
  let fighters = {};
  try {
    fighters = JSON.parse(readFileSync(OUT, "utf8"));
  } catch {}

  const ids = new Set();
  for (const f of fights) {
    ids.add(String(f.a.id));
    ids.add(String(f.b.id));
  }
  // Upcoming-card debutants have no historical fights but still need bios + priors.
  try {
    const upcoming = JSON.parse(readFileSync(new URL("../../data/ufc/upcoming.json", import.meta.url), "utf8"));
    for (const card of upcoming.cards) {
      for (const f of card.fights) {
        if (f.a.id) ids.add(String(f.a.id));
        if (f.b.id) ids.add(String(f.b.id));
      }
    }
  } catch {}
  const todo = [...ids].filter((id) => !(id in fighters) || !("proRecord" in fighters[id]));
  console.log(`${ids.size} fighters, ${todo.length} to fetch`);

  let done = 0;
  for (const id of todo) {
    if (!(id in fighters)) {
      const d = await fetchAthlete(id);
      fighters[id] = d
        ? {
            name: d.displayName ?? null,
            dob: d.dateOfBirth ?? null,
            height: d.height ?? null,
            reach: d.reach ?? null,
            stance: d.stance?.text ?? null,
          }
        : { name: null, dob: null };
      await sleep(DELAY_MS);
    }
    fighters[id].proRecord = await fetchProRecord(id);
    done++;
    if (done % 100 === 0) {
      writeFileSync(OUT, JSON.stringify(fighters, null, 1));
      console.log(`  ${done}/${todo.length}`);
    }
    await sleep(DELAY_MS);
  }

  writeFileSync(OUT, JSON.stringify(fighters, null, 1));
  const withDob = Object.values(fighters).filter((f) => f.dob).length;
  console.log(`wrote ${Object.keys(fighters).length} fighters (${withDob} with DOB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
