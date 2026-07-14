import RankList from "@/components/ufc/RankList";
import { getUfcRankings } from "@/lib/ufc/data";

export const metadata = { title: "Rankings — UFC CONSENSUS" };

export default function RankingsPage() {
  const { updatedAt, divisions } = getUfcRankings();
  const p4p = divisions.filter((d) => d.p4p);
  const weightClasses = divisions.filter((d) => !d.p4p);

  return (
    <div>
      <header className="site-header">
        <div className="site-kicker">01 / Official UFC rankings</div>
        <h1 className="site-title site-title--small">Rankings</h1>
        <p className="site-subtitle">
          The UFC&apos;s official panel rankings for every division, with our model&apos;s Elo
          beside each fighter — where the two disagree is where it gets interesting. Synced
          from ufc.com · updated {updatedAt.slice(0, 10)}.
        </p>
      </header>

      <section className="mt-10">
        <div className="section-heading" data-index="02">
          <h2>Pound-for-pound</h2>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {p4p.map((d) => (
            <div key={d.name}>
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {d.name.replace(" Rankings", "")}
              </h3>
              <RankList ranks={d.ranks} />
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="section-heading" data-index="03">
          <h2>Division boards</h2>
        </div>
        <div className="grid gap-x-4 gap-y-8 lg:grid-cols-2">
          {weightClasses.map((d) => (
            <div key={d.name}>
              <h3 className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                {d.name}
              </h3>
              <RankList ranks={d.ranks} champion={d.champion} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
