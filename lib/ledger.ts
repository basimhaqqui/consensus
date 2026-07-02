// Read the git-committed prediction ledger and score it. The JSON is
// imported statically, so the site picks up new entries on each deploy
// (the ledger workflow's commits trigger exactly that).

import ledger from "@/data/ledger.json";

type Entry = {
  id: string;
  kickoffISO: string;
  home: string;
  away: string;
  venue: string;
  forecasts: { model: number; blend: number; market: number | null };
  capturedAt: string;
  result?: { winnerKey: string; gradedAt: string };
};

export type SourceScore = {
  n: number;
  hits: number; // pick (side with p>0.5) matched the winner
  logloss: number; // mean binary log loss of the home-advance probability
};

export type LedgerSummary = {
  total: number;
  graded: number;
  model: SourceScore;
  blend: SourceScore;
  market: SourceScore; // only entries where a live market number existed
};

function score(pairs: [number, boolean][]): SourceScore {
  let hits = 0;
  let ll = 0;
  for (const [p, homeWon] of pairs) {
    if ((p >= 0.5) === homeWon) hits++;
    const q = Math.max(1e-6, Math.min(1 - 1e-6, homeWon ? p : 1 - p));
    ll += -Math.log(q);
  }
  return { n: pairs.length, hits, logloss: pairs.length ? ll / pairs.length : 0 };
}

export function ledgerSummary(): LedgerSummary {
  const entries = (ledger.entries as Entry[]).filter((e) => e.result);
  const homeWon = (e: Entry) => e.result!.winnerKey === e.home;
  return {
    total: (ledger.entries as Entry[]).length,
    graded: entries.length,
    model: score(entries.map((e) => [e.forecasts.model, homeWon(e)])),
    blend: score(entries.map((e) => [e.forecasts.blend, homeWon(e)])),
    market: score(
      entries
        .filter((e) => e.forecasts.market !== null)
        .map((e) => [e.forecasts.market!, homeWon(e)])
    ),
  };
}
