import type { MatchEvent } from "@/lib/match";
import { BallIcon } from "./PlayerMarkers";

// Match events feed: home events on the left of a central minute spine, away
// on the right — goals, cards, and substitutions with a halftime divider.

function Icon({ e }: { e: MatchEvent }) {
  if (e.type === "goal" || e.type === "pen-goal") {
    return (
      <span className="h-[14px] w-[14px] shrink-0">
        <BallIcon />
      </span>
    );
  }
  if (e.type === "own-goal") {
    return (
      <span className="h-[14px] w-[14px] shrink-0">
        <BallIcon muted />
      </span>
    );
  }
  if (e.type === "yellow")
    return <span className="h-[13px] w-[9px] shrink-0 rounded-[2px] bg-[#facc15]" />;
  if (e.type === "red")
    return <span className="h-[13px] w-[9px] shrink-0 rounded-[2px] bg-[#ef4444]" />;
  // substitution
  return (
    <span className="flex shrink-0 flex-col leading-none text-[10px] font-bold">
      <span className="text-accent">↑</span>
      <span className="text-danger">↓</span>
    </span>
  );
}

function Label({ e }: { e: MatchEvent }) {
  const [a, b] = e.players;
  if (e.type === "sub") {
    return (
      <span className="min-w-0">
        <span className="block truncate text-[12px] text-zinc-200">{a ?? "—"}</span>
        {b && <span className="block truncate text-[10px] text-muted">for {b}</span>}
      </span>
    );
  }
  const tag =
    e.type === "pen-goal" ? " (P)" : e.type === "own-goal" ? " (OG)" : "";
  return (
    <span className="min-w-0">
      <span
        className={`block truncate text-[12px] ${
          e.type === "goal" || e.type === "pen-goal" || e.type === "own-goal"
            ? "font-semibold text-text"
            : "text-zinc-200"
        }`}
      >
        {a ?? "—"}
        {tag}
      </span>
      {b && (
        <span className="block truncate text-[10px] text-muted">assist: {b}</span>
      )}
    </span>
  );
}

export default function MatchTimeline({ events }: { events: MatchEvent[] }) {
  if (events.length === 0) return null;
  const rows: (MatchEvent | "HT")[] = [];
  let prevPeriod = 1;
  for (const e of events) {
    if (e.period > prevPeriod) {
      rows.push("HT");
      prevPeriod = e.period;
    }
    rows.push(e);
  }

  return (
    <div className="space-y-1">
      {rows.map((r, i) =>
        r === "HT" ? (
          <div key={`ht${i}`} className="flex items-center gap-3 py-1">
            <span className="h-px flex-1 bg-line" />
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted">
              Half time
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
        ) : (
          <div
            key={i}
            className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2"
          >
            <div className="flex items-center justify-end gap-2 text-right">
              {r.side === "home" && (
                <>
                  <Label e={r} />
                  <Icon e={r} />
                </>
              )}
            </div>
            <span className="w-11 shrink-0 rounded-full border border-line bg-panel2/60 px-1 py-[1px] text-center text-[10px] tabnums text-muted">
              {r.minute || "—"}
            </span>
            <div className="flex items-center gap-2">
              {r.side === "away" && (
                <>
                  <Icon e={r} />
                  <Label e={r} />
                </>
              )}
            </div>
          </div>
        )
      )}
    </div>
  );
}
