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
    <div>
      <header className="site-header site-header--compact">
        <div className="section-heading" data-index="01">
          <h2>Public track record</h2>
          <span className="hidden text-[9px] text-zinc-600 sm:inline">append-only / independently auditable</span>
        </div>

        <div className="terminal-panel">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-accent to-transparent opacity-75" />
          <div className="terminal-panel-header flex items-center justify-between gap-4 px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_12px_rgba(52,211,153,0.65)]" />
              Forecast archive
            </span>
            <span className="tabnums">UFC / graded record</span>
          </div>

          <div className="relative overflow-hidden px-5 py-7 sm:px-7 sm:py-9">
            <div className="pointer-events-none absolute -right-24 top-1/2 h-64 w-64 -translate-y-1/2 bg-[radial-gradient(circle,rgba(52,211,153,0.09),transparent_68%)]" />
            <div className="relative max-w-4xl">
              <div className="site-kicker">Probability, with receipts</div>
              <h1 className="site-title text-[clamp(2.8rem,8vw,5.7rem)] leading-[0.86] tracking-[-0.055em]">
                The Ledger
              </h1>
              <p className="site-subtitle max-w-3xl">
                Every forecast is frozen no later than fight time with the de-vigged market at
                capture, then graded after the result lands. Wins stay. Misses stay. The record is
                never rewritten.
              </p>
              <div className="mt-5 flex flex-wrap gap-2 text-[9px] uppercase tracking-[0.16em]">
                <span className="rounded border border-accent/25 bg-accent/[0.07] px-2.5 py-1.5 text-accent">
                  Frozen pre-fight
                </span>
                <span className="rounded border border-line bg-white/[0.02] px-2.5 py-1.5 text-zinc-400">
                  Git-graded post-fight
                </span>
                <span className="rounded border border-line bg-white/[0.02] px-2.5 py-1.5 text-zinc-400">
                  No deletions
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section className="mt-10">
        <div className="section-heading" data-index="02">
          <h2>Performance statement</h2>
          <span className="text-[9px] uppercase tracking-[0.14em] text-muted">lower log loss is better</span>
        </div>
        <div className="terminal-kpi-grid grid grid-cols-2 gap-px lg:grid-cols-4">
          <Stat
            label="Overall record"
            value={graded.length ? `${hits}-${graded.length - hits}` : "—"}
            sub={graded.length ? `${graded.length} settled picks` : "awaiting results"}
          />
          <Stat
            label="Hit rate"
            value={graded.length ? pct(hits / graded.length) : "—"}
            sub={graded.length ? `${hits} of ${graded.length} correct` : "awaiting results"}
            valueClass="text-accent"
          />
          <Stat
            label="Model log loss"
            value={withBooks.length ? avg(withBooks.map((e) => e.result!.llModel!)).toFixed(3) : "—"}
            sub={withBooks.length ? `scored on n=${withBooks.length}` : "awaiting market grades"}
            valueClass="text-zinc-100"
          />
          <Stat
            label="Sample size"
            value={`${entries.length}`}
            sub={`${graded.length} graded / ${pending.length} pending`}
          />
        </div>
        <div className="terminal-panel mt-3 grid gap-px bg-line sm:grid-cols-3">
          <Benchmark
            label="Model"
            value={withBooks.length ? avg(withBooks.map((e) => e.result!.llModel!)).toFixed(3) : "—"}
            valueClass="text-accent"
          />
          <Benchmark
            label="Books"
            value={withBooks.length ? avg(withBooks.map((e) => e.result!.llBooks!)).toFixed(3) : "—"}
            valueClass="text-blue"
          />
          <Benchmark
            label="50 / 50 consensus"
            value={withBooks.length ? avg(withBooks.map((e) => llBlend(e)!)).toFixed(3) : "—"}
            valueClass="text-warn"
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="section-heading" data-index="03">
          <h2>All entries</h2>
          <span className="text-[11px] text-muted">[{entries.length}]</span>
        </div>

        {entries.length === 0 ? (
          <div className="terminal-empty p-8 text-center text-sm">
            No forecasts captured yet — the first entries freeze automatically about 12 hours
            before the next event and get graded after the results land.
          </div>
        ) : (
          <div className="terminal-panel">
            <div className="terminal-panel-header hidden grid-cols-[76px_minmax(0,1.35fr)_minmax(160px,0.8fr)_minmax(150px,0.7fr)] gap-5 px-5 py-2.5 text-[9px] uppercase tracking-[0.16em] text-muted md:grid">
              <span>Grade</span>
              <span>Bout / capture</span>
              <span>Forecast</span>
              <span className="text-right">Scoring</span>
            </div>
            <div className="divide-y divide-line/60">
              {entries.map((e) => {
                const pick = e.model_pA >= 0.5 ? e.a : e.b;
                const pickP = Math.max(e.model_pA, 1 - e.model_pA);
                const r = e.result;
                const hit = r && !r.noContest ? (e.model_pA >= 0.5 ? r.aWon : !r.aWon) : null;
                const grade = r ? (r.noContest ? "NC" : hit ? "HIT" : "MISS") : "OPEN";
                const gradeTone = r
                  ? r.noContest
                    ? "border-zinc-600/50 bg-zinc-800/40 text-zinc-400"
                    : hit
                      ? "border-accent/30 bg-accent/10 text-accent"
                      : "border-danger/30 bg-danger/10 text-danger"
                  : "border-blue/25 bg-blue/[0.07] text-blue";
                const method = r
                  ? r.noContest
                    ? "No contest"
                    : r.decision
                      ? `Decision · R${r.round ?? "—"}`
                      : `Finish · R${r.round ?? "—"}`
                  : "Awaiting grade";

                return (
                  <article
                    key={e.boutId}
                    className="group grid gap-4 px-4 py-4 transition-colors hover:bg-white/[0.025] md:grid-cols-[76px_minmax(0,1.35fr)_minmax(160px,0.8fr)_minmax(150px,0.7fr)] md:items-center md:gap-5 md:px-5"
                  >
                    <div className="flex items-center gap-3 md:block">
                      <span className={`display inline-flex min-w-14 items-center justify-center rounded border px-2 py-1.5 text-[10px] font-extrabold tracking-[0.12em] ${gradeTone}`}>
                        {grade}
                      </span>
                      <div className="text-[9px] uppercase tracking-[0.12em] text-zinc-600 md:mt-1.5">
                        {method}
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="display truncate text-xl font-bold text-zinc-200 group-hover:text-white">
                        {splitName(e.a.name).last}
                        <span className="px-1.5 text-zinc-700">vs</span>
                        {splitName(e.b.name).last}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[9px] uppercase tracking-[0.12em] text-muted">
                        <time dateTime={e.date} className="tabnums">{e.date.slice(0, 10)}</time>
                        <span className="text-zinc-700">/</span>
                        <span>{e.weightClass ?? "Weight class unlisted"}</span>
                        <span className="text-zinc-700">/</span>
                        <span className="truncate normal-case tracking-normal text-zinc-600">{e.event}</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-[9px] uppercase tracking-[0.15em] text-muted">Model pick</div>
                      <div className="mt-1 flex items-baseline gap-2">
                        <span className="display truncate text-base font-bold text-zinc-200">
                          {splitName(pick.name).last}
                        </span>
                        <span className="text-sm font-semibold text-accent tabnums">{pct(pickP)}</span>
                      </div>
                      <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-600 tabnums">
                        Books {e.books_pA !== null ? pct(e.model_pA >= 0.5 ? e.books_pA : 1 - e.books_pA) : "—"}
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-right md:border-0 md:pt-0">
                      <Score label="Model" value={r?.llModel?.toFixed(3) ?? "—"} />
                      <Score label="Books" value={r?.llBooks != null ? r.llBooks.toFixed(3) : "—"} muted />
                      <Score label="Cons." value={llBlend(e)?.toFixed(3) ?? "—"} valueClass="text-warn" />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="section-heading" data-index="04">
          <h2>Methodology</h2>
        </div>
        <div className="terminal-panel">
          <div className="terminal-panel-header flex items-center justify-between gap-3 px-4 py-2 text-[9px] uppercase tracking-[0.18em] text-muted sm:px-5">
            <span>Scoring protocol</span>
            <span className="tabnums">validation window / 2020+</span>
          </div>
          <p className="p-5 text-[11px] leading-relaxed text-muted sm:text-xs">
            The model is an online Elo over every UFC fight since 1993 — higher K while a fighter
            establishes themselves, extra weight on finishes, rating decay over long layoffs, and
            an age curve. Its constants were fitted on 2012–2019 and validated on 2020+ before
            launch. Book lines are the de-vigged average across US sportsbooks. A VALUE flag means
            the model and the books disagree by 8+ points — it is a disagreement, not a guarantee.
            Not betting advice.
          </p>
        </div>
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
    <div className="terminal-kpi px-4 py-4 sm:px-5">
      <div className="text-[9px] uppercase tracking-[0.18em] text-muted">{label}</div>
      <div className={`display mt-1 text-3xl font-extrabold tabnums ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-zinc-600 tabnums">{sub}</div>
    </div>
  );
}

function Benchmark({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 bg-[rgba(10,14,20,0.96)] px-4 py-3 sm:px-5">
      <div>
        <div className="text-[9px] uppercase tracking-[0.18em] text-muted">{label} log loss</div>
        <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-zinc-600">same graded sample</div>
      </div>
      <div className={`display text-xl font-bold tabnums ${valueClass}`}>{value}</div>
    </div>
  );
}

function Score({
  label,
  value,
  muted = false,
  valueClass = "",
}: {
  label: string;
  value: string;
  muted?: boolean;
  valueClass?: string;
}) {
  return (
    <div>
      <div className="text-[8px] uppercase tracking-[0.12em] text-zinc-600">LL {label}</div>
      <div className={`mt-1 text-[11px] tabnums ${muted ? "text-muted" : "text-zinc-300"} ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}
