# ▸ Consensus

A football intelligence terminal — live scores, our own prediction model, and the betting market, side by side.

**Live:** [consensus-football.vercel.app](https://consensus-football.vercel.app)

## What it does

- **Our own model.** An Elo rating engine computed from 49,000+ international results feeds a Dixon-Coles Poisson goals model with per-team attack/defence styles — win/draw/win probabilities, expected goals, likely scorelines, and to-advance odds (extra time and penalties derived, not hand-waved). Constants are fitted and validated by replay backtests over a decade of matches, never eyeballed.
- **The market, de-vigged.** Live sportsbook odds are averaged across books with the margin stripped out, shown next to the model everywhere — and blended 50/50 into the default "Consensus" view. Divergences of 8+ points get flagged as VALUE.
- **A public, graded track record.** A GitHub Actions cron snapshots every pre-match forecast into this repo before kickoff and grades it after the final whistle — log loss against the books, not cherry-picked win percentages. The git history is the receipt.
- **World Cup 2026 terminal.** Dynamic knockout bracket, 10,000-run tournament simulator with title-odds movement, path-to-the-final for every team, confirmed + predicted lineups on FUT-style player cards, match briefings from the day's headlines.
- **Bet builder.** Any market — results, totals, both-teams-to-score, player scoring props — priced off the model's joint score grid, so same-match combos are priced with their correlations instead of naive multiplication. Paste your book's price and it grades the edge.
- **League coverage.** Premier League, La Liga, Serie A, Bundesliga, Ligue 1, UCL/UEL/UECL, MLS, and Brasileirão — live scores, standings, and season projections powered by results-based club ratings with rating-uncertainty simulation.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind 4 · Vercel. No database — public sports APIs plus git-committed JSON state written by scheduled GitHub Actions.

## Running it

```bash
npm install
npm run dev
```

Runs with no configuration. Optional environment variables unlock the market layers:

| Variable | Enables |
|---|---|
| `ODDS_API_KEY` | Live sportsbook odds, VALUE flags, market ratings ([the-odds-api.com](https://the-odds-api.com)) |
| `APIFOOTBALL_KEY` | Confirmed lineups, player photos, scorer props ([api-football.com](https://www.api-football.com)) |
| `THESPORTSDB_KEY` | Player face cutouts ([thesportsdb.com](https://www.thesportsdb.com)) |

Model scripts: `node scripts/compute-ratings.mjs` rebuilds the Elo ratings from raw results; `node scripts/backtest.mjs` and `node scripts/backtest-goals.mjs` re-validate the model before any constant changes ship.

---

*For entertainment, not betting advice. Every number is a probability, not a promise.*
