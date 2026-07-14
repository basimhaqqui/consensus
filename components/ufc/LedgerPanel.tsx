import Link from "next/link";
import { getLedger } from "@/lib/ufc/data";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function LedgerPanel() {
  const entries = getLedger();
  if (!entries.length)
    return (
      <section className="mb-12 rounded-xl border border-line bg-panel/60 px-5 py-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted max-w-xl">
          Every forecast gets frozen ~12 hours before the fight and graded in public — win or
          lose. The first receipts land after the next event.
        </p>
        <Link href="/ufc/ledger" className="rounded-lg border border-line px-3 py-1.5 text-xs text-zinc-300 hover:border-accent/40">
          The Ledger →
        </Link>
      </section>
    );

  const graded = entries.filter((e) => e.result && !e.result.noContest);
  const pending = entries.length - graded.length;
  const withBooks = graded.filter((e) => e.result?.llBooks != null);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const llModel = withBooks.length ? avg(withBooks.map((e) => e.result!.llModel!)) : null;
  const llBooks = withBooks.length ? avg(withBooks.map((e) => e.result!.llBooks!)) : null;

  return (
    <section className="mb-12">
      <div className="mb-3 flex items-center gap-3">
        <Link href="/ufc/ledger" className="text-[11px] uppercase tracking-[0.2em] text-zinc-400 hover:text-accent">
          Ledger →
        </Link>
        <span className="text-[11px] text-muted">
          forecasts frozen pre-fight, graded after — every one, in git history
        </span>
        <span className="flex-1 h-px bg-line" />
      </div>
      <div className="rounded-xl border border-line bg-panel/70 card-shadow p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Graded</div>
            <div className="mt-1 tabnums text-2xl font-bold">{graded.length}</div>
            <div className="text-[11px] text-muted tabnums">{pending} pending</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Model log loss</div>
            <div className="mt-1 tabnums text-2xl font-bold text-accent">
              {llModel !== null ? llModel.toFixed(3) : "—"}
            </div>
            <div className="text-[11px] text-muted">lower is better</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted">Books log loss</div>
            <div className="mt-1 tabnums text-2xl font-bold text-accent2">
              {llBooks !== null ? llBooks.toFixed(3) : "—"}
            </div>
            <div className="text-[11px] text-muted tabnums">
              {withBooks.length ? `n=${withBooks.length}` : "awaiting results"}
            </div>
          </div>
        </div>
        {graded.length > 0 && (
          <div className="mt-5 border-t border-line pt-3 space-y-1 text-xs">
            {graded
              .slice(-8)
              .reverse()
              .map((e) => {
                const pick = e.model_pA >= 0.5 ? e.a.name : e.b.name;
                const hit = e.model_pA >= 0.5 ? e.result!.aWon : !e.result!.aWon;
                return (
                  <div key={e.boutId} className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-muted">
                      {e.a.name} vs {e.b.name}
                    </span>
                    <span className="shrink-0 tabnums">
                      picked {pick?.split(" ").at(-1)} {pct(Math.max(e.model_pA, 1 - e.model_pA))}{" "}
                      <span className={hit ? "text-accent" : "text-danger"}>{hit ? "✓" : "✗"}</span>
                    </span>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </section>
  );
}
