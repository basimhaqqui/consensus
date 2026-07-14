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
  return (
    <div className="terminal-panel">
      {champion && (
        <Link
          href={champion.id ? `/ufc/fighter/${champion.id}` : "#"}
          className="terminal-panel-header flex items-center gap-3 border-warn/30 px-4 py-2 hover:bg-warn/10"
        >
          <FighterFace id={champion.id} name={champion.name} size={40} />
          <div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-warn">Champion</div>
            <div className="display text-base font-extrabold leading-tight">{champion.name}</div>
          </div>
          <span className="ml-auto tabnums text-sm text-accent">
            {champion.id ? Math.round(getRating(champion.id)?.rating ?? 0) || "—" : "—"}
            <span className="ml-1 text-[9px] text-muted uppercase">elo</span>
          </span>
        </Link>
      )}
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => {
            const elo = r.id ? getRating(r.id)?.rating : null;
            return (
              <tr key={r.rank} className="border-b border-line/50 last:border-0">
                <td className="w-8 px-3 py-1.5 text-right tabnums text-muted">{r.rank}</td>
                <td className="px-2 py-1.5">
                  <Link
                    href={r.id ? `/ufc/fighter/${r.id}` : "#"}
                    className="flex items-center gap-2 font-medium hover:text-accent"
                  >
                    <FighterFace id={r.id} name={r.name} size={24} />
                    {r.name}
                  </Link>
                </td>
                <td className="px-3 py-1.5 text-right tabnums text-accent">
                  {elo ? Math.round(elo) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
