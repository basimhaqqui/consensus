import Link from "next/link";
import { notFound } from "next/navigation";
import FighterFace from "@/components/ufc/FighterFace";
import RatingChart from "@/components/ufc/RatingChart";
import { splitName } from "@/components/ufc/FaceOff";
import WatchlistButton from "@/components/WatchlistButton";
import {
  activeRank,
  ageOf,
  allFighterIds,
  ftIn,
  getBio,
  getCards,
  getFighterLog,
  getHistory,
  getRating,
} from "@/lib/ufc/data";

export function generateStaticParams() {
  return allFighterIds().map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getRating(id);
  return { title: r ? `${r.name} — UFC CONSENSUS` : "UFC CONSENSUS" };
}

export default async function FighterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = getRating(id);
  if (!r) notFound();

  const bio = getBio(id);
  const age = ageOf(id);
  const rank = activeRank(id);
  const history = getHistory(id);
  const log = getFighterLog(id);
  const { first, last } = splitName(r.name);
  const ufcRecord = `${r.wins}-${r.fights - r.wins}`;
  const finishes = log.filter((fight) => fight.won === true && !fight.decision).length;
  const latestResult = log[0]?.won;
  const streak =
    latestResult === null || latestResult === undefined
      ? 0
      : log.findIndex((fight) => fight.won !== latestResult);
  const streakCount = streak === -1 ? log.length : streak;
  const streakLabel = streakCount > 0 ? `${streakCount}${latestResult ? "W" : "L"}` : "—";
  const upcomingRef = getCards()
    .flatMap((card) => card.fights)
    .flatMap((fight) => [fight.a, fight.b])
    .find((fighter) => fighter.id === id);
  const flag = upcomingRef?.flag?.includes("blank.png") ? null : upcomingRef?.flag ?? null;
  const countryCode = flag?.match(/\/([a-z]{3})\.png(?:\?|$)/i)?.[1].toUpperCase() ?? null;

  const profile: [string, string | null][] = [
    ["Age", age !== null ? `${age} years` : null],
    ["Height", ftIn(bio?.height)],
    ["Reach", bio?.reach ? `${bio.reach}"` : null],
    ["Stance", bio?.stance ?? null],
    ["Division", r.division ?? null],
    ["Last fight", r.lastFight],
  ];

  const kpis = [
    {
      label: "Model Elo",
      value: `${Math.round(r.rating)}`,
      meta: rank !== null ? `#${rank} active P4P` : "active rating",
    },
    { label: "UFC record", value: ufcRecord, meta: `${r.fights} tracked bouts` },
    {
      label: "Finishes",
      value: `${finishes}`,
      meta: `${r.wins ? Math.round((finishes / r.wins) * 100) : 0}% of UFC wins`,
    },
    {
      label: "Current streak",
      value: streakLabel,
      meta:
        latestResult === true ? "wins" : latestResult === false ? "losses" : "no active run",
    },
  ];

  return (
    <div>
      <header className="site-header site-header--compact">
        <Link href="/ufc" className="back-link mb-7">
          <span aria-hidden="true">←</span> UFC desk
        </Link>

        <div className="section-heading" data-index="01">
          <h2>Fighter profile</h2>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">dossier / {id}</span>
        </div>

        <div className="terminal-panel">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-red to-transparent opacity-80" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-gradient-to-b from-transparent via-blue to-transparent opacity-70" />
          <div className="terminal-panel-header flex items-center justify-between gap-4 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted sm:px-6">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
              Combat dossier
            </span>
            <span className="tabnums">UFC / {r.fights < 5 ? "Provisional" : "Rated"}</span>
          </div>

          <div className="relative grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center sm:gap-8 sm:p-7 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
            <div className="relative mx-auto sm:mx-0">
              <div className="pointer-events-none absolute -inset-4 bg-[radial-gradient(circle,rgba(239,68,68,0.13),transparent_68%)]" />
              <FighterFace id={id} name={r.name} size={164} tone="red" />
            </div>

            <div className="min-w-0 text-center sm:text-left">
              <div className="mb-3 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                <span className="rounded border border-red/30 bg-red/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-red">
                  {r.division ?? "Open weight"}
                </span>
                {rank !== null && (
                  <span className="rounded border border-blue/30 bg-blue/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-blue tabnums">
                    #{rank} active P4P
                  </span>
                )}
                {r.fights < 5 && (
                  <span className="rounded border border-warn/30 bg-warn/10 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-warn">
                    Provisional
                  </span>
                )}
                <WatchlistButton
                  compact
                  item={{
                    key: `fighter:${id}`,
                    kind: "fighter",
                    title: r.name,
                    context: `${r.division ?? "UFC"} · Elo ${Math.round(r.rating)}`,
                    href: `/ufc/fighter/${id}`,
                  }}
                />
              </div>
              <div className="display text-lg font-semibold leading-none text-muted sm:text-xl">{first}&nbsp;</div>
              <h1 className="display text-[clamp(3rem,10vw,6.75rem)] font-extrabold leading-[0.78] tracking-[-0.035em] text-zinc-100">
                {last}
              </h1>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[10px] uppercase tracking-[0.15em] text-muted sm:justify-start">
                <span>
                  Record <strong className="ml-1 font-semibold text-zinc-300 tabnums">{ufcRecord}</strong>
                </span>
                <span className="hidden h-3 w-px bg-line sm:block" />
                <span className="flex items-center gap-2">
                  Nationality
                  {flag && <img src={flag} alt="" width={18} height={12} className="rounded-[2px] ring-1 ring-white/10" />}
                  <strong className="font-semibold text-zinc-300">{countryCode ?? "Unlisted"}</strong>
                </span>
              </div>
            </div>

            <div className="hidden min-w-32 border-l border-line/70 pl-7 text-right lg:block">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted">Consensus Elo</div>
              <div className="display mt-1 text-6xl font-extrabold leading-none text-red tabnums">
                {Math.round(r.rating)}
              </div>
              <div className="mt-2 text-[10px] uppercase tracking-[0.16em] text-zinc-600">Post-fight rating</div>
            </div>
          </div>

          <div className="terminal-kpi-grid grid grid-cols-2 gap-px rounded-none border-x-0 border-b-0 sm:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="terminal-kpi px-4 py-3.5 sm:px-5">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted">{kpi.label}</div>
                <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums sm:text-3xl">{kpi.value}</div>
                <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">{kpi.meta}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {history.length >= 2 && (
        <section className="mt-10">
          <div className="section-heading" data-index="02">
            <h2>Rating history</h2>
            <span className="text-[10px] text-muted">post-fight Elo / UFC bouts only</span>
          </div>
          <div className="terminal-panel">
            <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted sm:px-5">
              <span>Performance signal</span>
              <span className="tabnums">
                {history.length} samples <span className="px-1.5 text-zinc-700">/</span> latest {history.at(-1)?.[1]}
              </span>
            </div>
            <div className="px-3 pb-3 pt-4 sm:px-5 sm:pb-5">
              <RatingChart points={history} />
            </div>
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="section-heading" data-index="03">
          <h2>Fight history</h2>
          <span className="text-[10px] text-muted tabnums">{log.length} recorded bouts</span>
        </div>
        <div className="terminal-panel">
          <div className="terminal-panel-header hidden grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] gap-5 px-5 py-2 text-[10px] uppercase tracking-[0.16em] text-muted sm:grid">
            <span>Opponent / result</span>
            <span>Event</span>
            <span className="text-right">Method</span>
          </div>
          <div className="divide-y divide-line/60">
            {log.map((fight) => {
              const result = fight.won === null ? "D" : fight.won ? "W" : "L";
              const resultTone =
                fight.won === null
                  ? "border-zinc-600/50 bg-zinc-800/40 text-zinc-400"
                  : fight.won
                    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-400"
                    : "border-danger/30 bg-danger/10 text-danger";
              const method = fight.decision ? "Decision" : fight.round ? `Finish · R${fight.round}` : "—";

              return (
                <article
                  key={fight.boutId}
                  className="group grid gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.025] focus-within:bg-white/[0.025] sm:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_auto] sm:items-center sm:gap-5 sm:px-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`display flex h-8 w-8 shrink-0 items-center justify-center rounded border text-sm font-extrabold ${resultTone}`}>
                      {result}
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/ufc/fighter/${fight.opponent.id}`}
                        className="display block truncate text-lg font-bold text-zinc-200 group-hover:text-white sm:text-xl"
                      >
                        {fight.opponent.name}
                      </Link>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[10px] uppercase tracking-[0.12em] text-muted tabnums">
                        <time dateTime={fight.date}>{fight.date.slice(0, 10)}</time>
                        {fight.weightClass && (
                          <>
                            <span className="text-zinc-700">/</span>
                            <span>{fight.weightClass}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="min-w-0 pl-11 sm:pl-0">
                    <div className="truncate text-[11px] text-zinc-400">{fight.eventName}</div>
                  </div>
                  <div className="flex items-center justify-between gap-3 pl-11 sm:block sm:pl-0 sm:text-right">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600 sm:hidden">Method</span>
                    <div>
                      <div className="text-[10px] font-medium uppercase tracking-[0.13em] text-zinc-300">{method}</div>
                      {!fight.decision && fight.clock && (
                        <div className="mt-0.5 text-[10px] text-muted tabnums">{fight.clock}</div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-10">
        <div className="section-heading" data-index="04">
          <h2>Fighter stats</h2>
          <span className="text-[10px] text-muted">tale of the tape</span>
        </div>
        <div className="terminal-panel">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3">
            {profile.map(([label, value], index) => (
              <div
                key={label}
                className={`flex items-center justify-between gap-4 border-line/60 px-4 py-3.5 sm:px-5 ${
                  index < profile.length - 1 ? "border-b" : ""
                } ${index % 2 === 0 ? "sm:border-r" : ""} ${index < 4 ? "sm:border-b" : "sm:border-b-0"} ${
                  index < 3 ? "lg:border-b" : "lg:border-b-0"
                } ${
                  index % 3 !== 2 ? "lg:border-r" : "lg:border-r-0"
                }`}
              >
                <span className="text-[10px] uppercase tracking-[0.17em] text-muted">{label}</span>
                <span className="text-right text-xs font-medium text-zinc-300 tabnums">{value ?? "—"}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
