import type { ProjRow } from "@/lib/projection";
import Crest from "./Crest";

function p(n: number) {
  if (n >= 0.9995) return "✓";
  if (n <= 0) return "·";
  const v = n * 100;
  if (v < 1) return "<1";
  return `${Math.round(v)}`;
}

function titlePct(n: number) {
  const v = n * 100;
  if (v <= 0) return "<0.1%";
  if (v < 10) return `${v.toFixed(1)}%`;
  return `${Math.round(v)}%`;
}

export default function LeagueProjection({
  rows,
  showUcl,
  showUecl,
  showReleg,
  topLabel = "UCL",
  titleLabel = "Win league",
}: {
  rows: ProjRow[];
  showUcl: boolean;
  showUecl?: boolean;
  showReleg: boolean;
  topLabel?: string;
  titleLabel?: string;
}) {
  const max = Math.max(...rows.map((r) => r.title), 0.001);
  const cols = ["1.6fr", "3fr", "3rem"];
  if (showUcl) cols.push("2.6rem");
  if (showUecl) cols.push("2.6rem");
  if (showReleg) cols.push("2.6rem");
  const grid = { gridTemplateColumns: cols.join(" ") };

  return (
    <div className="terminal-panel">
      <div
        className="terminal-panel-header grid gap-2 px-4 py-2 text-[9px] uppercase tracking-[0.14em] text-muted"
        style={grid}
      >
        <span>Team</span>
        <span>{titleLabel}</span>
        <span className="text-right">Pts</span>
        {showUcl && <span className="text-right">{topLabel}</span>}
        {showUecl && <span className="text-right">CON</span>}
        {showReleg && <span className="text-right">Rel</span>}
      </div>

      <div className="divide-y divide-line/60">
        {rows.map((r, i) => (
          <div
            key={r.abbr}
            className="grid items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-white/[0.025]"
            style={grid}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-muted w-4 tabnums text-right">
                {i + 1}
              </span>
              <Crest src={r.logo} code={r.abbr} size={16} />
              <span className="truncate">{r.name}</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-2.5 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full ${
                    i === 0 ? "bg-accent" : i < 4 ? "bg-accent/70" : "bg-accent/40"
                  }`}
                  style={{ width: `${Math.max(2, (r.title / max) * 100)}%` }}
                />
              </div>
              <span className="tabnums text-xs w-12 text-right">
                {titlePct(r.title)}
              </span>
            </div>

            <span className="tabnums text-right text-xs text-muted">
              {Math.round(r.projPts)}
            </span>
            {showUcl && (
              <span className="tabnums text-right text-xs text-sky-400/90">
                {p(r.ucl)}
              </span>
            )}
            {showUecl && (
              <span className="tabnums text-right text-xs text-cyan-400/90">
                {p(r.uecl)}
              </span>
            )}
            {showReleg && (
              <span className="tabnums text-right text-xs text-danger/90">
                {p(r.releg)}
              </span>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-2 text-[10px] text-muted border-t border-line">
        Projected over the remaining fixtures · 3,000 simulations · Pts =
        projected final points
        {topLabel === "PLAYOFF"
          ? " · PLAYOFF = odds to reach the MLS Cup playoffs (incl. wild card)."
          : ` · ${topLabel} / CON / Rel = odds to finish in a Champions League / Conference League / relegation place.`}
      </div>
    </div>
  );
}
