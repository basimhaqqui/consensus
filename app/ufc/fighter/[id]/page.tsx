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
    <div>
      <header className="site-header site-header--compact flex flex-wrap items-end gap-5">
        <FighterFace id={id} name={r.name} size={132} />
        <div className="min-w-0">
          <Link href="/ufc" className="back-link mb-6">
            ← UFC desk
          </Link>
          <div className="site-kicker">01 / Fighter intelligence</div>
          <div className="display text-lg font-semibold text-muted leading-none">{first}&nbsp;</div>
          <h1 className="site-title">
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

      <section className="mt-10">
        <div className="section-heading" data-index="02">
          <h2>Tale of the tape</h2>
        </div>
        <div className="terminal-kpi-grid grid grid-cols-3 gap-px sm:grid-cols-6">
          {tape.map(([label, value]) => (
            <div key={label} className="terminal-kpi px-3 py-3 text-center">
              <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
              <div className="mt-0.5 text-sm font-semibold tabnums">{value ?? "—"}</div>
            </div>
          ))}
        </div>
      </section>

      {history.length >= 2 && (
        <section className="mt-8">
          <div className="section-heading" data-index="03">
            <h2>Rating history</h2>
            <span className="text-[11px] text-muted">post-fight Elo, UFC fights only</span>
          </div>
          <div className="terminal-panel p-4">
            <RatingChart points={history} />
          </div>
        </section>
      )}

      <section className="mt-8">
        <div className="section-heading" data-index="04">
          <h2>Fight log</h2>
          <span className="text-[11px] text-muted">[{log.length}]</span>
        </div>
        <div className="terminal-panel overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="terminal-panel-header text-[10px] uppercase tracking-wider text-muted">
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
