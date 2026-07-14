import Link from "next/link";
import RankList from "@/components/ufc/RankList";
import { getUfcRankings } from "@/lib/ufc/data";

export const metadata = { title: "Rankings — UFC CONSENSUS" };

export default function RankingsPage() {
  const { updatedAt, divisions } = getUfcRankings();
  const p4p = divisions.filter((d) => d.p4p);
  const weightClasses = divisions.filter((d) => !d.p4p);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <div className="pt-5">
        <Link href="/ufc" className="display text-base font-bold tracking-tight flex items-center gap-1.5">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </Link>
      </div>

      <header className="pt-8 pb-6">
        <div className="text-[11px] uppercase tracking-[0.25em] text-accent">
          Official UFC rankings
        </div>
        <h1 className="display mt-2 text-3xl sm:text-5xl font-extrabold tracking-tight">
          Rankings
        </h1>
        <p className="mt-3 text-sm text-muted max-w-2xl leading-relaxed">
          The UFC&apos;s official panel rankings for every division, with our model&apos;s Elo
          beside each fighter — where the two disagree is where it gets interesting. Synced
          from ufc.com · updated {updatedAt.slice(0, 10)}.
        </p>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        {p4p.map((d) => (
          <div key={d.name}>
            <h2 className="display mb-2 text-lg font-extrabold text-zinc-300">{d.name.replace(" Rankings", "")}</h2>
            <RankList ranks={d.ranks} />
          </div>
        ))}
      </section>

      <section className="mt-10 grid gap-x-4 gap-y-8 lg:grid-cols-2">
        {weightClasses.map((d) => (
          <div key={d.name}>
            <h2 className="display mb-2 text-lg font-extrabold text-zinc-300">{d.name}</h2>
            <RankList ranks={d.ranks} champion={d.champion} />
          </div>
        ))}
      </section>
    </div>
  );
}
