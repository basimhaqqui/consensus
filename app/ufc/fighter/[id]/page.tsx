import Link from "next/link";
import { notFound } from "next/navigation";
import FighterFace from "@/components/ufc/FighterFace";
import RatingChart from "@/components/ufc/RatingChart";
import { splitName } from "@/components/ufc/FaceOff";
import {
  activeRank,
  ageOf,
  allFighterIds,
  ftIn,
  getBio,
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

  const tape: [string, string | null][] = [
    ["Age", age !== null ? `${age}` : null],
    ["Height", ftIn(bio?.height)],
    ["Reach", bio?.reach ? `${bio.reach}"` : null],
    ["Stance", bio?.stance ?? null],
    ["UFC record", `${r.wins}-${r.fights - r.wins}`],
    ["Last fight", r.lastFight],
  ];

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <div className="pt-5">
        <Link href="/ufc" className="display text-base font-bold tracking-tight flex items-center gap-1.5">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </Link>
      </div>

      <header className="pt-8 pb-6 flex flex-wrap items-end gap-5">
        <FighterFace id={id} name={r.name} size={132} />
        <div className="min-w-0">
          <div className="display text-lg font-semibold text-muted leading-none">{first}&nbsp;</div>
          <h1 className="display text-4xl sm:text-6xl font-extrabold leading-[0.95] tracking-tight">
            {last}
          </h1>
          <div className="mt-2 flex items-baseline gap-4">
            <span className="display text-3xl font-extrabold text-accent tabnums">
              {Math.round(r.rating)}
            </span>
            {rank !== null && (
              <span className="text-xs text-muted tabnums">#{rank} P4P</span>
            )}
            {r.fights < 5 && <span className="text-xs text-warn">provisional</span>}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {tape.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-line bg-panel/60 px-3 py-2 text-center">
            <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
            <div className="mt-0.5 text-sm font-semibold tabnums">{value ?? "—"}</div>
          </div>
        ))}
      </section>

      {history.length >= 2 && (
        <section className="mt-8">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="display text-lg font-extrabold text-zinc-300">Rating history</h2>
            <span className="text-[11px] text-muted">post-fight Elo, UFC fights only</span>
            <span className="flex-1 h-px bg-line" />
          </div>
          <div className="rounded-xl border border-line bg-panel/70 card-shadow p-4">
            <RatingChart points={history} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="display text-lg font-extrabold text-zinc-300">Fight log</h2>
          <span className="text-[11px] text-muted">[{log.length}]</span>
          <span className="flex-1 h-px bg-line" />
        </div>
        <div className="rounded-xl border border-line bg-panel/70 card-shadow overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line bg-panel2/60 text-[10px] uppercase tracking-wider text-muted">
                <th className="px-4 py-2 text-left">Date</th>
                <th className="px-2 py-2 text-center w-8">W/L</th>
                <th className="px-2 py-2 text-left">Opponent</th>
                <th className="px-2 py-2 text-left max-sm:hidden">Event</th>
                <th className="px-4 py-2 text-right">Ended</th>
              </tr>
            </thead>
            <tbody className="tabnums">
              {log.map((f) => (
                <tr key={f.boutId} className="border-b border-line/50 last:border-0">
                  <td className="px-4 py-1.5 text-muted whitespace-nowrap">{f.date.slice(0, 10)}</td>
                  <td className="px-2 py-1.5 text-center">
                    {f.won === null ? (
                      <span className="text-zinc-500">D</span>
                    ) : (
                      <span className={f.won ? "text-accent" : "text-danger"}>{f.won ? "W" : "L"}</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5">
                    <Link href={`/ufc/fighter/${f.opponent.id}`} className="hover:text-accent">
                      {f.opponent.name}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-muted max-sm:hidden truncate max-w-52">{f.eventName}</td>
                  <td className="px-4 py-1.5 text-right text-muted whitespace-nowrap">
                    {f.decision ? "decision" : f.round ? `R${f.round} ${f.clock ?? ""}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
