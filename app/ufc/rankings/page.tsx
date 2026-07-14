import RankList from "@/components/ufc/RankList";
import { getUfcRankings } from "@/lib/ufc/data";

export const metadata = { title: "Rankings — UFC CONSENSUS" };

export default function RankingsPage() {
  const { updatedAt, divisions } = getUfcRankings();
  const p4p = divisions.filter((d) => d.p4p);
  const weightClasses = divisions.filter((d) => !d.p4p);

  return (
    <div>
      <header className="site-header site-header--compact">
        <div className="section-heading" data-index="01">
          <h2>Rankings intelligence</h2>
          <span className="hidden text-[9px] text-zinc-600 sm:inline">official order / independent model</span>
        </div>

        <div className="terminal-panel">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-red to-transparent opacity-75" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-gradient-to-b from-transparent via-blue to-transparent opacity-65" />
          <div className="terminal-panel-header flex items-center justify-between gap-4 px-4 py-2 text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red shadow-[0_0_12px_rgba(239,68,68,0.65)]" />
              Division intelligence board
            </span>
            <span className="tabnums">UFC / official panel</span>
          </div>

          <div className="relative overflow-hidden px-5 py-7 sm:px-7 sm:py-9">
            <div className="pointer-events-none absolute -left-20 top-1/2 h-60 w-60 -translate-y-1/2 bg-[radial-gradient(circle,rgba(239,68,68,0.09),transparent_68%)]" />
            <div className="pointer-events-none absolute -right-20 top-1/2 h-60 w-60 -translate-y-1/2 bg-[radial-gradient(circle,rgba(59,130,246,0.09),transparent_68%)]" />
            <div className="relative max-w-4xl">
              <div className="site-kicker">Official position. Independent signal.</div>
              <h1 className="site-title text-[clamp(2.8rem,8vw,5.7rem)] leading-[0.86] tracking-[-0.055em]">
                Rankings
              </h1>
              <p className="site-subtitle max-w-3xl">
                The UFC&apos;s official panel order for every division, overlaid with the model&apos;s
                Elo and each fighter&apos;s tracked UFC record. The disagreement between reputation
                and rating is the intelligence layer.
              </p>
            </div>
          </div>

          <div className="terminal-kpi-grid grid grid-cols-3 gap-px rounded-none border-x-0 border-b-0">
            <HeaderStat label="P4P boards" value={`${p4p.length}`} meta="official lists" />
            <HeaderStat label="Divisions" value={`${weightClasses.length}`} meta="weight classes" />
            <HeaderStat label="Last sync" value={updatedAt.slice(0, 10)} meta="from ufc.com" compact />
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-x-4 gap-y-9 lg:grid-cols-2">
        {p4p.map((d, index) => (
          <section key={d.name}>
            <div className="section-heading" data-index={String(index + 2).padStart(2, "0")}>
              <h2>{d.name.replace(" Rankings", "")}</h2>
              <span className="text-[9px] text-muted tabnums">{d.ranks.length} ranked</span>
            </div>
            <RankList ranks={d.ranks} />
          </section>
        ))}
      </div>

      <div className="mt-9 grid gap-x-4 gap-y-9 lg:grid-cols-2">
        {weightClasses.map((d, index) => (
          <section key={d.name}>
            <div
              className="section-heading"
              data-index={String(index + p4p.length + 2).padStart(2, "0")}
            >
              <h2>{d.name}</h2>
              <span className="text-[9px] text-muted tabnums">{d.ranks.length} contenders</span>
            </div>
            <RankList ranks={d.ranks} champion={d.champion} />
          </section>
        ))}
      </div>
    </div>
  );
}

function HeaderStat({
  label,
  value,
  meta,
  compact = false,
}: {
  label: string;
  value: string;
  meta: string;
  compact?: boolean;
}) {
  return (
    <div className="terminal-kpi min-w-0 px-3 py-3.5 sm:px-5">
      <div className="text-[8px] uppercase tracking-[0.16em] text-muted sm:text-[9px] sm:tracking-[0.18em]">{label}</div>
      <div className={`display mt-1 truncate font-bold text-zinc-100 tabnums ${compact ? "text-sm sm:text-xl" : "text-2xl sm:text-3xl"}`}>
        {value}
      </div>
      <div className="mt-1 hidden text-[9px] uppercase tracking-[0.12em] text-zinc-600 sm:block">{meta}</div>
    </div>
  );
}
