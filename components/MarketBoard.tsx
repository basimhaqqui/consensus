import {
  scoreGrid,
  marketLegs,
  playerLegDefs,
  probOf,
  americanFromProbStr,
  decimalFromProb,
  type PlayerProp,
} from "@/lib/markets";

// Model fair prices for the derived markets of one match — what each market
// is worth with zero bookmaker margin. Server-rendered from the lambdas.
export default function MarketBoard({
  lambdaHome,
  lambdaAway,
  homeCode,
  awayCode,
  players = [],
}: {
  lambdaHome: number;
  lambdaAway: number;
  homeCode: string;
  awayCode: string;
  players?: PlayerProp[];
}) {
  const grid = scoreGrid(lambdaHome, lambdaAway);
  const legs = [...marketLegs(homeCode, awayCode), ...playerLegDefs(players)];
  const groups = new Map<string, typeof legs>();
  for (const l of legs) {
    (groups.get(l.group) ?? groups.set(l.group, []).get(l.group)!).push(l);
  }

  return (
    <section className="terminal-panel mt-5 p-4">
      <div className="section-heading mb-4" data-index="03">
        <h2>
          Markets — model fair prices
        </h2>
        <span className="hidden text-[10px] text-zinc-600 sm:inline">
          90&apos; markets · no margin — compare to your book
        </span>
      </div>
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        {[...groups.entries()].map(([name, ls]) => (
          <div key={name}>
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.16em] text-zinc-600">
              {name}
            </div>
            <div className="divide-y divide-line/50">
              {ls.map((l) => {
                const p = probOf(grid, l);
                return (
                  <div
                    key={l.key}
                    className="flex items-baseline justify-between gap-2 py-1.5 text-xs transition-colors hover:bg-white/[0.018]"
                  >
                    <span className="text-zinc-300">{l.label}</span>
                    <span className="tabnums text-muted">
                      {(p * 100).toFixed(0)}%
                      <span className="ml-2 inline-block w-12 text-right text-zinc-400">
                        {americanFromProbStr(p)}
                      </span>
                      <span className="ml-2 inline-block w-10 text-right text-zinc-600">
                        {decimalFromProb(p) < 100
                          ? decimalFromProb(p).toFixed(2)
                          : "—"}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[10px] text-zinc-600">
        Fair odds = the model&apos;s probability with no bookmaker margin. A book
        price better than fair is model value; worse is the margin you&apos;re
        paying. Entertainment, not betting advice.
      </p>
    </section>
  );
}
