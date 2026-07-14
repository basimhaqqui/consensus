import Link from "next/link";
import FighterFace from "@/components/ufc/FighterFace";
import { getRating } from "@/lib/ufc/data";

export type RankEntry = { rank: number; name: string; id: string | null };

// One official-rankings table: UFC's order, our Elo beside it.
export default function RankList({
  ranks,
  champion,
  limit,
}: {
  ranks: RankEntry[];
  champion?: { name: string; id: string | null } | null;
  limit?: number;
}) {
  const rows = limit ? ranks.slice(0, limit) : ranks;
  const championRating = champion?.id ? getRating(champion.id) : undefined;

  return (
    <div className="terminal-panel">
      {champion && (
        <Link
          href={champion.id ? `/ufc/fighter/${champion.id}` : "#"}
          className="terminal-panel-header group flex items-center gap-3 border-warn/25 px-4 py-3 transition-colors hover:bg-warn/[0.06] sm:px-5"
        >
          <span className="display flex h-9 w-9 shrink-0 items-center justify-center rounded border border-warn/30 bg-warn/10 text-[10px] font-extrabold tracking-[0.12em] text-warn">
            C
          </span>
          <FighterFace id={champion.id} name={champion.name} size={42} />
          <div className="min-w-0">
            <div className="text-[8px] uppercase tracking-[0.2em] text-warn">Division champion</div>
            <div className="display truncate text-lg font-extrabold leading-tight text-zinc-100 group-hover:text-white">
              {champion.name}
            </div>
            {championRating && (
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.12em] text-zinc-600 tabnums">
                UFC record {championRating.wins}-{championRating.fights - championRating.wins}
              </div>
            )}
          </div>
          <div className="ml-auto text-right">
            <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Model Elo</div>
            <div className="display mt-0.5 text-xl font-bold text-accent tabnums">
              {champion.id ? Math.round(championRating?.rating ?? 0) || "—" : "—"}
            </div>
          </div>
        </Link>
      )}
      <div className="terminal-panel-header grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2 text-[8px] uppercase tracking-[0.16em] text-muted sm:grid-cols-[42px_minmax(0,1fr)_auto_auto] sm:px-5">
        <span className="text-center">Rank</span>
        <span>Fighter dossier</span>
        <span className="hidden text-right sm:block">UFC record</span>
        <span className="text-right">Model Elo</span>
      </div>
      <div className="divide-y divide-line/60">
        {rows.map((r) => {
          const rating = r.id ? getRating(r.id) : undefined;
          const elo = rating?.rating;
          const podium = r.rank <= 3;

          return (
            <div
              key={r.rank}
              className="group grid grid-cols-[42px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.025] focus-within:bg-white/[0.025] sm:grid-cols-[42px_minmax(0,1fr)_auto_auto] sm:px-5"
            >
              <span className={`display flex h-8 w-8 items-center justify-center rounded border text-sm font-extrabold tabnums ${podium ? "border-red/25 bg-red/[0.07] text-zinc-100" : "border-line bg-white/[0.015] text-muted"}`}>
                {r.rank}
              </span>
              <Link
                href={r.id ? `/ufc/fighter/${r.id}` : "#"}
                className="flex min-w-0 items-center gap-2.5"
              >
                <FighterFace id={r.id} name={r.name} size={34} />
                <div className="min-w-0">
                  <div className="display truncate text-base font-bold text-zinc-300 group-hover:text-white">
                    {r.name}
                  </div>
                  {rating && (
                    <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600 tabnums sm:hidden">
                      {rating.wins}-{rating.fights - rating.wins} UFC
                    </div>
                  )}
                </div>
              </Link>
              <div className="hidden min-w-16 text-right sm:block">
                <div className="text-[11px] text-zinc-400 tabnums">
                  {rating ? `${rating.wins}-${rating.fights - rating.wins}` : "—"}
                </div>
                <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">tracked</div>
              </div>
              <div className="min-w-12 text-right">
                <div className="display text-base font-bold text-accent tabnums">
                  {elo ? Math.round(elo) : "—"}
                </div>
                <div className="text-[8px] uppercase tracking-[0.1em] text-zinc-700">post-fight</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
