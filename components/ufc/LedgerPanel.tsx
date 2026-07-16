import Link from "next/link";
import { getLedger } from "@/lib/ufc/data";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function LedgerPanel() {
  const entries = getLedger();
  if (!entries.length)
    return (
      <section className="terminal-panel mb-12">
        <div className="terminal-panel-header px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted sm:px-5">
          Public forecast record
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <p className="max-w-xl text-xs leading-relaxed text-muted">
            Every forecast gets frozen ~12 hours before the fight and graded in public — win or
            lose. The first receipts land after the next event.
          </p>
          <Link href="/ufc/ledger" className="rounded border border-accent/30 bg-accent/[0.07] px-3 py-2 text-[10px] uppercase tracking-[0.15em] text-accent transition-colors hover:border-accent/60 hover:bg-accent/10">
            Open ledger →
          </Link>
        </div>
      </section>
    );

  const graded = entries.filter((e) => e.result && !e.result.noContest);
  const pending = entries.length - graded.length;
  const withBooks = graded.filter((e) => e.result?.llBooks != null);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const llModel = withBooks.length ? avg(withBooks.map((e) => e.result!.llModel!)) : null;
  const llBooks = withBooks.length ? avg(withBooks.map((e) => e.result!.llBooks!)) : null;
  const hits = graded.filter((e) => (e.model_pA >= 0.5 ? e.result!.aWon : !e.result!.aWon)).length;

  return (
    <section className="mb-12">
      <div className="section-heading" data-index="03">
        <h2><Link href="/ufc/ledger" className="hover:text-accent">Prediction ledger →</Link></h2>
        <span className="hidden text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
          frozen pre-fight / git-graded post-fight
        </span>
      </div>
      <div className="terminal-panel">
        <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted sm:px-5">
          <span className="flex items-center gap-2 text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_rgba(52,211,153,0.55)]" />
            Auditable performance
          </span>
          <span className="tabnums">{entries.length} forecasts / {pending} open</span>
        </div>

        <div className="terminal-kpi-grid grid grid-cols-2 gap-px rounded-none border-x-0 border-t-0 lg:grid-cols-4">
          <div className="terminal-kpi px-4 py-3.5 sm:px-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Record</div>
            <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums">{graded.length ? `${hits}-${graded.length - hits}` : "—"}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">graded picks</div>
          </div>
          <div className="terminal-kpi px-4 py-3.5 sm:px-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Hit rate</div>
            <div className="display mt-1 text-2xl font-bold text-accent tabnums">
              {graded.length ? pct(hits / graded.length) : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600 tabnums">{hits} correct</div>
          </div>
          <div className="terminal-kpi px-4 py-3.5 sm:px-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Model log loss</div>
            <div className="display mt-1 text-2xl font-bold text-accent tabnums">
              {llModel !== null ? llModel.toFixed(3) : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">lower is better</div>
          </div>
          <div className="terminal-kpi px-4 py-3.5 sm:px-5">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Books log loss</div>
            <div className="display mt-1 text-2xl font-bold text-blue tabnums">
              {llBooks !== null ? llBooks.toFixed(3) : "—"}
            </div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600 tabnums">
              {withBooks.length ? `n=${withBooks.length}` : "awaiting results"}
            </div>
          </div>
        </div>
        {graded.length > 0 && (
          <div className="divide-y divide-line/60">
            {graded
              .slice(-8)
              .reverse()
              .map((e) => {
                const pick = e.model_pA >= 0.5 ? e.a.name : e.b.name;
                const hit = e.model_pA >= 0.5 ? e.result!.aWon : !e.result!.aWon;
                return (
                  <div key={e.boutId} className="group flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.025] sm:flex-nowrap sm:px-5">
                    <span className={`display inline-flex min-w-12 shrink-0 justify-center rounded border px-2 py-1 text-[10px] font-extrabold tracking-[0.12em] ${hit ? "border-accent/30 bg-accent/10 text-accent" : "border-danger/30 bg-danger/10 text-danger"}`}>
                      {hit ? "HIT" : "MISS"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted group-hover:text-zinc-400">
                      {e.a.name} <span className="text-zinc-700">vs</span> {e.b.name}
                    </span>
                    <span className="ml-auto shrink-0 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      Model pick
                    </span>
                    <span className="shrink-0 text-xs text-zinc-300 tabnums">
                      {pick?.split(" ").at(-1)} <strong className={hit ? "font-semibold text-accent" : "font-semibold text-danger"}>{pct(Math.max(e.model_pA, 1 - e.model_pA))}</strong>
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
