import Crest from "./Crest";

type Stats = Record<string, string>;

const ROWS: { key: string; label: string; pct?: boolean }[] = [
  { key: "possessionPct", label: "Possession", pct: true },
  { key: "totalShots", label: "Shots" },
  { key: "shotsOnTarget", label: "Shots on target" },
  { key: "wonCorners", label: "Corners" },
  { key: "totalPasses", label: "Passes" },
  { key: "accuratePasses", label: "Accurate passes" },
  { key: "totalTackles", label: "Tackles" },
  { key: "interceptions", label: "Interceptions" },
  { key: "totalClearance", label: "Clearances" },
  { key: "totalCrosses", label: "Crosses" },
  { key: "offsides", label: "Offsides" },
  { key: "foulsCommitted", label: "Fouls" },
  { key: "yellowCards", label: "Yellow cards" },
  { key: "redCards", label: "Red cards" },
  { key: "saves", label: "Saves" },
];

const num = (v?: string) => {
  const n = parseFloat(v ?? "");
  return Number.isNaN(n) ? 0 : n;
};

export default function TeamStats({
  home,
  away,
  homeKey,
  awayKey,
  homeLogo,
  awayLogo,
}: {
  home: Stats;
  away: Stats;
  homeKey?: string;
  awayKey?: string;
  homeLogo?: string;
  awayLogo?: string;
}) {
  const rows = ROWS.filter((r) => home[r.key] !== undefined || away[r.key] !== undefined);

  return (
    <section className="mt-5 rounded-xl border border-line bg-panel/50 p-4 card-shadow">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400">
          Match stats
        </h2>
        <div className="flex items-center gap-3">
          <Crest teamKey={homeKey} src={homeLogo} size={18} />
          <span className="text-[10px] text-muted">vs</span>
          <Crest teamKey={awayKey} src={awayLogo} size={18} />
        </div>
      </div>

      <div className="space-y-2.5">
        {rows.map((r) => {
          const h = num(home[r.key]);
          const a = num(away[r.key]);
          const total = h + a || 1;
          const hPct = (h / total) * 100;
          const hWins = h > a;
          const aWins = a > h;
          const fmt = (raw: string | undefined, v: number) =>
            r.pct ? `${Math.round(v)}%` : raw ?? "0";
          return (
            <div key={r.key}>
              <div className="flex items-center justify-between text-xs tabnums mb-0.5">
                <span className={hWins ? "text-text font-semibold" : "text-muted"}>
                  {fmt(home[r.key], h)}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                  {r.label}
                </span>
                <span className={aWins ? "text-text font-semibold" : "text-muted"}>
                  {fmt(away[r.key], a)}
                </span>
              </div>
              <div className="flex h-1.5 w-full gap-px">
                <div className="flex-1 bg-zinc-800 rounded-l-full overflow-hidden flex justify-end">
                  <div
                    className={hWins ? "bg-accent" : "bg-accent/50"}
                    style={{ width: `${hPct}%` }}
                  />
                </div>
                <div className="flex-1 bg-zinc-800 rounded-r-full overflow-hidden">
                  <div
                    className={`h-full ${aWins ? "bg-sky-400" : "bg-sky-400/50"}`}
                    style={{ width: `${100 - hPct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
