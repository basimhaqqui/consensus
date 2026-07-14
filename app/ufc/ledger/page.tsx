import Link from "next/link";
import { splitName } from "@/components/ufc/FaceOff";
import { getLedger } from "@/lib/ufc/data";

export const metadata = { title: "Ledger — UFC CONSENSUS" };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

export default function LedgerPage() {
  const entries = [...getLedger()].sort((a, b) => b.date.localeCompare(a.date));
  const graded = entries.filter((e) => e.result && !e.result.noContest);
  const pending = entries.filter((e) => !e.result);
  const withBooks = graded.filter((e) => e.result?.llBooks != null);
  const avg = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const hits = graded.filter((e) => (e.model_pA >= 0.5 ? e.result!.aWon : !e.result!.aWon)).length;
  const llOf = (p: number, aWon: boolean) =>
    -Math.log(Math.min(1 - 1e-9, Math.max(1e-9, aWon ? p : 1 - p)));
  const llBlend = (e: (typeof entries)[number]) =>
    e.books_pA !== null && e.result && !e.result.noContest
      ? llOf((e.model_pA + e.books_pA) / 2, e.result.aWon!)
      : null;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <div className="pt-5">
        <Link href="/ufc" className="display text-base font-bold tracking-tight flex items-center gap-1.5">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </Link>
      </div>

      <header className="pt-8 pb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">Public record</div>
        <h1 className="display mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight">
          The Ledger
        </h1>
        <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
          Every forecast is frozen into this ledger no later than fight time, alongside the
          de-vigged book consensus at capture. After the fight it gets graded — win or lose —
          and nothing is ever edited or deleted. The score that matters is log loss against
          the books: anyone can pick winners, the question is whether the probabilities are
          honest.
        </p>
      </header>

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Forecasts" value={`${entries.length}`} sub={`${pending.length} pending`} />
        <Stat
          label="Picks hit"
          value={graded.length ? `${hits}/${graded.length}` : "—"}
          sub={graded.length ? pct(hits / graded.length) : "awaiting results"}
        />
        <Stat
          label="Model log loss"
          value={withBooks.length ? avg(withBooks.map((e) => e.result!.llModel!)).toFixed(3) : "—"}
          sub="lower is better"
          valueClass="text-accent"
        />
        <Stat
          label="Books log loss"
          value={withBooks.length ? avg(withBooks.map((e) => e.result!.llBooks!)).toFixed(3) : "—"}
          sub={withBooks.length ? `n=${withBooks.length}` : "the bar to clear"}
          valueClass="text-blue"
        />
        <Stat
          label="Consensus LL"
          value={withBooks.length ? avg(withBooks.map((e) => llBlend(e)!)).toFixed(3) : "—"}
          sub="50/50 blend"
          valueClass="text-warn"
        />
      </section>

      <section className="mt-10">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="display text-lg font-extrabold text-zinc-300">All entries</h2>
          <span className="text-[11px] text-muted">[{entries.length}]</span>
          <span className="flex-1 h-px bg-line" />
        </div>

        {entries.length === 0 ? (
          <div className="rounded-xl border border-line bg-panel/60 p-8 text-center text-sm text-muted">
            No forecasts captured yet — the first entries freeze automatically about 12 hours
            before the next event and get graded after the results land.
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-panel/70 card-shadow overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-line bg-panel2/60 text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-2 py-2 text-left">Fight</th>
                  <th className="px-2 py-2 text-right">Model</th>
                  <th className="px-2 py-2 text-right">Books</th>
                  <th className="px-2 py-2 text-center">Result</th>
                  <th className="px-2 py-2 text-right">LL model</th>
                  <th className="px-2 py-2 text-right">LL books</th>
                  <th className="px-4 py-2 text-right">LL cons.</th>
                </tr>
              </thead>
              <tbody className="tabnums">
                {entries.map((e) => {
                  const pick = e.model_pA >= 0.5 ? e.a : e.b;
                  const pickP = Math.max(e.model_pA, 1 - e.model_pA);
                  const r = e.result;
                  const hit = r && !r.noContest ? (e.model_pA >= 0.5 ? r.aWon : !r.aWon) : null;
                  return (
                    <tr key={e.boutId} className="border-b border-line/50 last:border-0">
                      <td className="px-4 py-1.5 text-muted whitespace-nowrap">{e.date.slice(0, 10)}</td>
                      <td className="px-2 py-1.5">
                        {splitName(e.a.name).last} vs {splitName(e.b.name).last}
                      </td>
                      <td className="px-2 py-1.5 text-right whitespace-nowrap">
                        {splitName(pick.name).last} {pct(pickP)}
                      </td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        {e.books_pA !== null ? pct(e.model_pA >= 0.5 ? e.books_pA : 1 - e.books_pA) : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {r ? (
                          r.noContest ? (
                            <span className="text-zinc-500">NC</span>
                          ) : (
                            <span className={hit ? "text-accent" : "text-danger"}>{hit ? "✓" : "✗"}</span>
                          )
                        ) : (
                          <span className="text-zinc-600">…</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">{r?.llModel?.toFixed(3) ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right text-muted">
                        {r?.llBooks != null ? r.llBooks.toFixed(3) : "—"}
                      </td>
                      <td className="px-4 py-1.5 text-right text-warn">
                        {llBlend(e)?.toFixed(3) ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10 rounded-lg border border-line bg-panel/60 p-5 text-xs text-muted leading-relaxed">
        <h2 className="display text-sm font-bold text-zinc-300 mb-2">Methodology</h2>
        <p>
          The model is an online Elo over every UFC fight since 1993 — higher K while a fighter
          establishes themselves, extra weight on finishes, rating decay over long layoffs, and
          an age curve. Its constants were fitted on 2012–2019 and validated on 2020+ before
          launch. Book lines are the de-vigged average across US sportsbooks. A VALUE flag means
          the model and the books disagree by 8+ points — it is a disagreement, not a guarantee.
          Not betting advice.
        </p>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  valueClass = "",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-panel/70 card-shadow p-4 text-center">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 display text-2xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="text-[11px] text-muted tabnums">{sub}</div>
    </div>
  );
}
