import type { StandingsGroup } from "@/lib/standings";
import Crest from "./Crest";

// ESPN's qualification colors are washed-out pale blues (Europa vs Conference
// are near-identical) — remap to clear, distinct colors.
function zoneColor(text: string, fallback: string): string {
  const t = text.toLowerCase();
  if (t.includes("champions")) return "#3b82f6"; // blue
  if (t.includes("europa")) return "#f59e0b"; // amber
  if (t.includes("conference")) return "#22d3ee"; // cyan
  if (t.includes("relegation")) return "#f87171"; // red
  if (t.includes("advance")) return "#34d399"; // green (WC)
  return fallback;
}

export default function Standings({
  groups,
  highlightTop,
}: {
  groups: StandingsGroup[];
  highlightTop?: number; // accent the top N (e.g. 2 for WC groups that advance)
}) {
  const multi = groups.length > 1;
  return (
    <div className={multi ? "grid gap-3 sm:grid-cols-2" : ""}>
      {groups.map((g) => (
        <div
          key={g.name}
          className="terminal-panel"
        >
          <div className="terminal-panel-header px-3 py-2 text-[9px] uppercase tracking-[0.16em] text-zinc-400">
            {g.name}
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted">
                <th className="text-left font-normal py-1.5 pl-3 w-5">#</th>
                <th className="text-left font-normal">Team</th>
                <th className="text-right font-normal w-6">P</th>
                <th className="text-right font-normal w-6 hidden sm:table-cell">W</th>
                <th className="text-right font-normal w-6 hidden sm:table-cell">D</th>
                <th className="text-right font-normal w-6 hidden sm:table-cell">L</th>
                <th className="text-right font-normal w-8">GD</th>
                <th className="text-right font-normal w-7 pr-3">Pts</th>
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => {
                const top = highlightTop && r.rank <= highlightTop;
                const barColor = r.note
                  ? zoneColor(r.note.text, r.note.color)
                  : top
                  ? "#34d399"
                  : undefined;
                return (
                  <tr
                    key={r.abbr + r.name}
                    className="border-t border-line/50 tabnums transition-colors hover:bg-white/[0.018]"
                  >
                    <td className="py-1.5 pl-3 text-muted relative">
                      {barColor && (
                        <span
                          className="absolute left-0 top-0 bottom-0 w-0.5"
                          style={{ backgroundColor: barColor }}
                        />
                      )}
                      {r.rank}
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Crest src={r.logo} code={r.abbr} size={14} className="w-4" />
                        <span className="truncate">{r.name}</span>
                      </div>
                    </td>
                    <td className="text-right text-muted">{r.gp}</td>
                    <td className="text-right text-muted hidden sm:table-cell">{r.w}</td>
                    <td className="text-right text-muted hidden sm:table-cell">{r.d}</td>
                    <td className="text-right text-muted hidden sm:table-cell">{r.l}</td>
                    <td className="text-right text-muted">
                      {r.gd > 0 ? `+${r.gd}` : r.gd}
                    </td>
                    <td className="text-right font-semibold pr-3">{r.pts}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <Legend group={g} />
        </div>
      ))}
    </div>
  );
}

function Legend({ group }: { group: StandingsGroup }) {
  const seen = new Map<string, string>();
  group.rows.forEach((r) => {
    if (r.note?.text && !seen.has(r.note.text)) seen.set(r.note.text, r.note.color);
  });
  const items = [...seen.entries()];
  if (!items.length) return null;

  const texts = items.map(([t]) => t.toLowerCase());
  const hasEuro = texts.some((t) => /champions|europa/.test(t));
  const hasConf = texts.some((t) => /conference/.test(t));
  const cupConference = hasEuro && !hasConf; // e.g. England — cup-decided

  return (
    <div className="border-t border-line/50">
      <div className="px-3 py-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-muted">
        {items.map(([text, color]) => (
          <span key={text} className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: zoneColor(text, color) }}
            />
            {text}
          </span>
        ))}
        {cupConference && (
          <span className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-sm shrink-0"
              style={{ backgroundColor: "#22d3ee" }}
            />
            Conference League — via domestic cup
          </span>
        )}
      </div>
      {cupConference && (
        <div className="px-3 pb-2 text-[9px] text-zinc-600">
          This league&apos;s Conference League place is awarded to a domestic cup
          winner, so it isn&apos;t tied to a fixed table position.
        </div>
      )}
    </div>
  );
}
