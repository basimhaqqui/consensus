import type { BracketMatch, Round, Slot } from "@/lib/bracket";
import Crest from "./Crest";

type Bracket = Record<Round, BracketMatch[]>;

const COLS: { round: Round; label: string }[] = [
  { round: "R32", label: "Round of 32" },
  { round: "R16", label: "Round of 16" },
  { round: "QF", label: "Quarter-finals" },
  { round: "SF", label: "Semi-finals" },
  { round: "Final", label: "Final" },
];
const ROUND_INDEX: Record<Round, number> = { R32: 0, R16: 1, QF: 2, SF: 3, Final: 4 };

// layout geometry (px)
const COL_W = 212;
const BOX_W = 188;
const BOX_H = 40;
const ROW = 42; // vertical pitch per R32 leaf
const GAP = COL_W - BOX_W;
const PAD_TOP = 26; // room for column labels

export default function BracketView({ bracket }: { bracket: Bracket }) {
  const all = COLS.flatMap((c) => bracket[c.round]);
  const byId = new Map(all.map((m) => [m.id, m]));

  // vertical order of R32 leaves = in-order traversal from the final
  const leaves = (id: string): string[] => {
    const m = byId.get(id);
    if (!m?.feeders) return [id];
    return [...leaves(m.feeders[0]), ...leaves(m.feeders[1])];
  };
  const finalMatch = bracket.Final[0];
  const order = finalMatch ? leaves(finalMatch.id) : bracket.R32.map((m) => m.id);

  const leafCenter = new Map<string, number>();
  order.forEach((id, i) => leafCenter.set(id, PAD_TOP + i * ROW + ROW / 2));

  const centerMemo = new Map<string, number>();
  const center = (id: string): number => {
    if (centerMemo.has(id)) return centerMemo.get(id)!;
    const m = byId.get(id)!;
    const c = m.feeders
      ? (center(m.feeders[0]) + center(m.feeders[1])) / 2
      : leafCenter.get(id)!;
    centerMemo.set(id, c);
    return c;
  };

  const totalW = COLS.length * COL_W;
  const totalH = PAD_TOP + order.length * ROW;

  // connector line segments
  const lines: { left: number; top: number; w: number; h: number }[] = [];
  for (const m of all) {
    if (!m.feeders) continue;
    const r = ROUND_INDEX[m.round];
    const childRight = (r - 1) * COL_W + BOX_W;
    const parentLeft = r * COL_W;
    const barX = (childRight + parentLeft) / 2;
    const cs = m.feeders.map(center).sort((a, b) => a - b);
    const [topY, botY] = cs;
    // stubs out of each child
    for (const y of m.feeders.map(center)) {
      lines.push({ left: childRight, top: y, w: barX - childRight, h: 1 });
    }
    // vertical bar joining the two children
    lines.push({ left: barX, top: topY, w: 1, h: botY - topY });
    // stub into the parent
    lines.push({ left: barX, top: center(m.id), w: parentLeft - barX, h: 1 });
  }

  return (
    <div className="w-full overflow-x-auto pb-2">
      <div className="relative mx-auto" style={{ width: totalW, height: totalH }}>
        {/* column labels */}
        {COLS.map((c, i) => (
          <div
            key={c.round}
            className="absolute top-0 text-center text-[9px] uppercase tracking-[0.18em] text-zinc-400"
            style={{ left: i * COL_W, width: BOX_W }}
          >
            {c.label}
          </div>
        ))}

        {/* connectors */}
        {lines.map((l, i) => (
          <div
            key={i}
            className="absolute bg-[rgba(125,136,150,0.25)]"
            style={{ left: l.left, top: l.top, width: l.w, height: l.h }}
          />
        ))}

        {/* matches */}
        {all.map((m) => (
          <div
            key={m.id}
            className="absolute"
            style={{
              left: ROUND_INDEX[m.round] * COL_W,
              top: center(m.id) - BOX_H / 2,
              width: BOX_W,
            }}
          >
            <Cell m={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Cell({ m }: { m: BracketMatch }) {
  const isLive = m.status === "live";
  const isFinal = m.status === "final";
  const showScore = isLive || isFinal;
  return (
    <div
      className={`overflow-hidden rounded-md border bg-[rgba(10,14,20,0.94)] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_8px_24px_-16px_rgba(0,0,0,0.9)] ${
        isLive ? "border-accent/60" : "border-[var(--hairline)]"
      }`}
    >
      <SlotRow
        slot={m.home}
        score={m.score?.home}
        showScore={showScore}
        winner={isFinal && m.winnerKey === m.home.key}
        loser={isFinal && !!m.winnerKey && m.winnerKey !== m.home.key}
        top
      />
      <SlotRow
        slot={m.away}
        score={m.score?.away}
        showScore={showScore}
        winner={isFinal && m.winnerKey === m.away.key}
        loser={isFinal && !!m.winnerKey && m.winnerKey !== m.away.key}
      />
    </div>
  );
}

function SlotRow({
  slot,
  score,
  showScore,
  winner,
  loser,
  top,
}: {
  slot: Slot;
  score?: number;
  showScore: boolean;
  winner?: boolean;
  loser?: boolean;
  top?: boolean;
}) {
  const known = !!slot.key;
  return (
    <div
      className={`flex items-center gap-1.5 px-1.5 h-[19px] text-[11px] ${
        top ? "border-b border-line/40" : ""
      } ${winner ? "bg-accent/10" : ""}`}
    >
      {slot.key ? (
        <Crest teamKey={slot.key} code={slot.label} size={14} className="w-4" />
      ) : (
        <span className="w-4 text-center text-muted">·</span>
      )}
      <span
        className={`flex-1 truncate ${
          loser
            ? "text-zinc-600"
            : winner
            ? "text-text font-semibold"
            : known
            ? "text-zinc-200"
            : "text-muted italic"
        }`}
      >
        {slot.label}
      </span>
      {showScore && (
        <span
          className={`tabnums ${loser ? "text-zinc-600" : "text-text font-semibold"}`}
        >
          {score}
        </span>
      )}
    </div>
  );
}
