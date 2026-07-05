// Movement since roughly a day ago, from the git-committed odds snapshots
// the ledger workflow appends every run. Static import — refreshes per
// deploy, which the workflow's commits trigger (same pattern as the ledger).

import history from "@/data/odds-history.json";

type Snapshot = {
  at: string;
  champ: Record<string, number>; // consensus title odds by team key
  match: Record<string, { model: number; books: number | null }>; // advance, home side
};

const snapshots = (history as { snapshots: Snapshot[] }).snapshots;

// Baseline = the oldest snapshot inside the window, so "since yesterday"
// degrades gracefully to "since this morning" early on. Requires some age,
// or the delta is meaningless.
function baseline(): Snapshot | null {
  const now = Date.now();
  const MIN_AGE = 6 * 3600_000;
  const WINDOW = 28 * 3600_000;
  const eligible = snapshots.filter((s) => {
    const age = now - Date.parse(s.at);
    return age >= MIN_AGE && age <= WINDOW;
  });
  return eligible[0] ?? null;
}

export function champDelta(key: string, current: number): number | undefined {
  const b = baseline();
  const prev = b?.champ?.[key];
  return prev === undefined ? undefined : current - prev;
}

export function booksDelta(matchId: string, current: number): number | undefined {
  const b = baseline();
  const prev = b?.match?.[matchId]?.books;
  return prev == null ? undefined : current - prev;
}
