import type { Player, Squad } from "@/lib/match";
import PlayerFace from "./PlayerFace";
import { ratingColor } from "./PlayerCard";
import { cardTheme } from "./theme";
import {
  Goals,
  Assists,
  Cards,
  hasGoals,
  hasAssists,
  hasCards,
} from "./PlayerMarkers";

const bySide = (a: Player, b: Player) => a.side - b.side;

// Drop the first name only, so "Charles De Ketelaere" -> "De Ketelaere"
// (a plain last-word split would truncate compound surnames).
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

// How advanced a player is, used to assign them to the correct formation line.
function rank(p: Player): number {
  const x = p.pos.toUpperCase();
  if (p.band === "GK") return 0;
  if (p.band === "DEF") return /(^LB|^RB|WB|B$)/.test(x) ? 2 : 1; // fullback vs CB
  if (p.band === "MID") {
    if (/DM|CDM|DMF/.test(x)) return 2.5;
    if (/AM|CAM|AMF/.test(x)) return 4;
    return 3;
  }
  // forwards: lone central striker sits highest
  return x === "F" || x === "ST" || x === "CF" || x === "S" ? 5.5 : 5;
}

const bandRank = (p: Player) =>
  ({ GK: 0, DEF: 1, MID: 2, FWD: 3 }[p.band] ?? 2);

// Build pitch rows from the REAL formation string (e.g. "3-4-2-1"); players are
// slotted into those lines by position. Falls back to band grouping if the
// formation is missing or the counts don't line up.
function buildRows(squad: Squad): Player[][] {
  const gk = squad.starters.filter((p) => p.band === "GK");
  const out = squad.starters.filter((p) => p.band !== "GK");

  const lines = (squad.formation ?? "")
    .split("-")
    .map((n) => parseInt(n, 10))
    .filter((n) => !Number.isNaN(n));
  const sum = lines.reduce((a, b) => a + b, 0);

  if (lines.length >= 2 && sum === out.length) {
    const sorted = [...out].sort((a, b) => rank(a) - rank(b));
    const rows: Player[][] = [];
    let i = 0;
    for (const n of lines) {
      rows.push(sorted.slice(i, i + n).sort(bySide));
      i += n;
    }
    return [gk, ...rows].filter((r) => r.length > 0);
  }

  // fallback: group by band
  const def = out.filter((p) => p.band === "DEF").sort(bySide);
  const mid = out.filter((p) => p.band === "MID").sort(bySide);
  const fwd = out.filter((p) => p.band === "FWD").sort(bySide);
  return [gk, def, mid, fwd].filter((r) => r.length > 0);
}

type Placed = { p: Player; x: number; y: number };
export type Orient = "h" | "v";

// Place a squad on one half of the pitch.
// Horizontal: home attacks right (GK far left x≈4 → forwards near centre x≈47);
// away mirrored on both axes.
// Vertical (mobile, FotMob style): home on the top half attacking down (GK at
// the top), away mirrored on the bottom half.
function layout(squad: Squad, dir: "home" | "away", orient: Orient): Placed[] {
  const rows = buildRows(squad);
  const R = rows.length;
  // Keeper hugs the goal line; outfield lines spread toward the halfway line,
  // leaving a gap in the middle so the two teams don't collide.
  // Stop short of the halfway line so opposing forward lines don't collide.
  const alongStart = orient === "h" ? 4 : 6;
  const alongEnd = 44;
  const out: Placed[] = [];
  rows.forEach((row, i) => {
    const t = R <= 1 ? 0 : i / (R - 1);
    let along = alongStart + t * (alongEnd - alongStart);
    if (dir === "away") along = 100 - along;
    const k = row.length;
    row.forEach((p, j) => {
      // Spread the line across the pitch with a small edge margin.
      let across = 7 + ((j + 0.5) / k) * 86;
      if (dir === "away") across = 100 - across;
      out.push(
        orient === "h"
          ? { p, x: along, y: across }
          : { p, x: across, y: along }
      );
    });
  });
  return out;
}

// Both teams on a single shared pitch (FotMob style).
export function PitchDuo({
  home,
  away,
  onSelect,
  orient = "h",
}: {
  home: Squad;
  away: Squad;
  onSelect?: (p: Player, sq: Squad) => void;
  orient?: Orient;
}) {
  const placed = [
    ...layout(home, "home", orient).map((o) => ({ ...o, sq: home })),
    ...layout(away, "away", orient).map((o) => ({ ...o, sq: away })),
  ];

  // man of the match: best rating on the pitch (blue pill + star, FotMob style)
  const motm = placed.reduce<Placed | null>(
    (best, cur) =>
      cur.p.rating !== undefined &&
      (best === null || cur.p.rating > (best.p.rating ?? 0))
        ? cur
        : best,
    null
  );

  const shape =
    orient === "h"
      ? "aspect-[7/5] min-h-[460px]"
      : "aspect-[2/3] min-h-[560px] max-w-[440px] mx-auto";

  return (
    <div
      className={`relative w-full ${shape} rounded-xl border border-line overflow-hidden card-shadow`}
      style={{
        background: `repeating-linear-gradient(${
          orient === "h" ? "90deg" : "0deg"
        },#0b2417 0,#0b2417 6.25%,#0d2a1b 6.25%,#0d2a1b 12.5%)`,
      }}
    >
      {/* depth vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ boxShadow: "inset 0 0 90px rgba(0,0,0,0.5)" }}
      />

      {/* field markings */}
      {orient === "h" ? (
        <div className="absolute inset-0 pointer-events-none text-white/15">
          {/* halfway line + centre circle + spot */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2 bg-current" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 h-[26%] aspect-square rounded-full border border-current" />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
          {/* left penalty area, six-yard box, penalty spot */}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[52%] w-[15%] border-y border-r border-current" />
          <div className="absolute left-0 top-1/2 -translate-y-1/2 h-[26%] w-[6%] border-y border-r border-current" />
          <div className="absolute left-[10%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-current" />
          {/* right penalty area, six-yard box, penalty spot */}
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[52%] w-[15%] border-y border-l border-current" />
          <div className="absolute right-0 top-1/2 -translate-y-1/2 h-[26%] w-[6%] border-y border-l border-current" />
          <div className="absolute right-[10%] top-1/2 h-1 w-1 -translate-y-1/2 rounded-full bg-current" />
        </div>
      ) : (
        <div className="absolute inset-0 pointer-events-none text-white/15">
          {/* halfway line + centre circle + spot */}
          <div className="absolute top-1/2 left-0 right-0 h-px -translate-y-1/2 bg-current" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[36%] aspect-square rounded-full border border-current" />
          <div className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
          {/* top penalty area, six-yard box, penalty spot */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[52%] h-[15%] border-x border-b border-current" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[26%] h-[6%] border-x border-b border-current" />
          <div className="absolute top-[10%] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" />
          {/* bottom penalty area, six-yard box, penalty spot */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[52%] h-[15%] border-x border-t border-current" />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[26%] h-[6%] border-x border-t border-current" />
          <div className="absolute bottom-[10%] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-current" />
        </div>
      )}

      {placed.map(({ p, x, y, sq }) => (
        <DuoDot
          key={sq.abbr + (p.id ?? p.name) + p.pos}
          p={p}
          x={x}
          y={y}
          color={sq.color}
          alt={sq.alt}
          crest={sq.logo}
          motm={motm !== null && motm.p === p}
          onSelect={() => onSelect?.(p, sq)}
        />
      ))}
    </div>
  );
}

export { bandRank };

// FIFA Ultimate Team style mini-card in the team's colours, with the match
// markers hung off the frame FotMob-style: colour-coded rating pill top-right
// (blue + star for the match's best), substitution minute over a red arrow
// top-left, goals bottom-right, assists bottom-left, cards on the left edge.
function DuoDot({
  p,
  x,
  y,
  color,
  alt,
  crest,
  motm,
  onSelect,
}: {
  p: Player;
  x: number;
  y: number;
  color?: string;
  alt?: string;
  crest?: string;
  motm?: boolean;
  onSelect?: () => void;
}) {
  const t = cardTheme(color, alt);
  return (
    <button
      type="button"
      onClick={onSelect}
      style={{ left: `${x}%`, top: `${y}%` }}
      className="absolute w-[48px] sm:w-[64px] -translate-x-1/2 -translate-y-1/2 group"
    >
      <div className="relative transition-transform duration-150 group-hover:scale-110 group-hover:z-10">
        <div
          className="relative overflow-hidden rounded-md sm:rounded-lg shadow-lg shadow-black/50"
          style={{ background: t.grad }}
        >
          {/* crest watermark — the team's identity behind the player */}
          {crest && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={crest}
              alt=""
              className="pointer-events-none absolute left-1/2 top-[46%] w-[105%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-[0.16] saturate-[1.4]"
            />
          )}

          {/* rim + top shine */}
          <div
            className="pointer-events-none absolute inset-0 rounded-md sm:rounded-lg"
            style={{
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,0.35), inset 0 0 0 1px rgba(0,0,0,0.35)",
            }}
          />

          {/* jersey number + position (top-left column; rating lives top-right;
              nudged inward when the sub-off badge occupies the corner) */}
          <div
            className={`absolute z-10 flex flex-col items-start ${
              p.subbedOut
                ? "left-[13px] top-[6px] sm:left-4 sm:top-2"
                : "left-[3px] top-[3px] sm:left-1.5 sm:top-1.5"
            }`}
          >
            <span
              className="text-[9px] sm:text-[11px] font-extrabold tabnums leading-none"
              style={{
                color: t.ink,
                // strong enough to read over the white api-football photos
                textShadow: "0 1px 3px rgba(0,0,0,0.8)",
              }}
            >
              {p.jersey}
            </span>
            <span
              className="mt-[2px] text-[6px] sm:text-[8px] font-bold uppercase tracking-wide leading-none"
              style={{ color: t.sub, textShadow: "0 1px 3px rgba(0,0,0,0.7)" }}
            >
              {p.pos}
            </span>
          </div>

          {/* face cutout */}
          <div
            className="relative mx-auto mt-1 h-9 w-9 translate-x-[4px] sm:mt-1.5 sm:h-12 sm:w-12 sm:translate-x-[5px]"
            style={{ color: t.ink }}
          >
            <PlayerFace srcs={[p.headshot, p.photo, p.img]} jersey={p.jersey} shape="square" />
          </div>

          {/* name band — solid bar in the team's second colour */}
          <div
            className="relative z-10 mt-[1px] px-[3px] py-[2px] sm:px-1"
            style={{ background: t.bandBg, color: t.bandInk }}
          >
            <span className="block truncate text-center text-[7px] sm:text-[9px] font-bold uppercase tracking-wide leading-tight">
              {shortName(p.name)}
            </span>
          </div>
        </div>

        {/* rating pill — top-right corner, FotMob colours; blue + star = MOTM */}
        {p.rating !== undefined && (
          <span
            className="absolute -right-2 -top-2 z-20 inline-flex items-center gap-[2px] rounded-full px-[4px] sm:px-[5px] py-[1px] text-[9px] sm:text-[11px] font-bold tabnums leading-[1.35] text-white shadow-md ring-1 ring-black/30"
            style={{ backgroundColor: motm ? "#2f7cf6" : ratingColor(p.rating) }}
          >
            {p.rating.toFixed(1)}
            {motm && <span className="text-[8px] leading-none">★</span>}
          </span>
        )}

        {/* sub-off — minute over a red arrow, top-left (FotMob) */}
        {p.subbedOut && (
          <span className="absolute -left-2 -top-2 z-20 flex flex-col items-center">
            {p.subMinute && (
              <span
                className="text-[8px] sm:text-[9px] font-semibold tabnums leading-none text-white"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.9)" }}
              >
                {p.subMinute}
              </span>
            )}
            <span
              className="mt-[1px] grid h-3.5 w-3.5 sm:h-4 sm:w-4 place-items-center rounded-full bg-[#e0524f] text-[9px] sm:text-[10px] font-bold leading-none text-white shadow-md ring-1 ring-black/30"
              title="Substituted off"
            >
              ←
            </span>
          </span>
        )}

        {/* goals bottom-right, assists bottom-left — riding the photo/band
            seam so they never cover the name; cards on the left edge */}
        {hasGoals(p) && (
          <span className="absolute bottom-2.5 -right-1.5 z-20 sm:bottom-3">
            <Goals p={p} />
          </span>
        )}
        {hasAssists(p) && (
          <span className="absolute bottom-2.5 -left-1.5 z-20 sm:bottom-3">
            <Assists p={p} />
          </span>
        )}
        {hasCards(p) && (
          <span className="absolute -left-2 top-1/2 z-20 -translate-y-1/2">
            <Cards p={p} />
          </span>
        )}
      </div>
    </button>
  );
}
