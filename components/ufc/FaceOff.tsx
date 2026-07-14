import Link from "next/link";
import FighterFace from "@/components/ufc/FighterFace";
import { MethodChips, TriBar, TriProb } from "@/components/ufc/Tri";
import ViewToggle from "@/components/ufc/ViewToggle";
import LiveBadge from "@/components/ufc/LiveBadge";
import ResultBanner from "@/components/ufc/ResultBanner";
import FightStats from "@/components/ufc/FightStats";
import { ageOf, consensusPA, getBookLine, VALUE_GAP, type FightForecast, type FighterRef } from "@/lib/ufc/data";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

const SUFFIXES = new Set(["jr.", "jr", "sr.", "sr", "ii", "iii", "iv"]);
// particles that belong to the surname: Benoît "Saint Denis", "Du Plessis", "Van Der..."
const PARTICLES = new Set(["saint", "st.", "de", "del", "dos", "da", "van", "von", "der", "du", "le", "la", "machado"]);

export function splitName(name: string | null): { first: string; last: string } {
  const words = (name ?? "TBA").split(" ").filter(Boolean);
  if (words.length < 2) return { first: "", last: words[0] ?? "TBA" };
  let cut = words.length - 1;
  if (SUFFIXES.has(words[cut].toLowerCase()) && cut > 1) cut--;
  while (cut > 1 && PARTICLES.has(words[cut - 1].toLowerCase())) cut--;
  return { first: words.slice(0, cut).join(" "), last: words.slice(cut).join(" ") };
}

function Corner({
  fighter,
  probs,
  tone,
  align,
}: {
  fighter: FighterRef;
  probs: { c: number; m: number; b: number | null };
  tone: "red" | "blue";
  align: "left" | "right";
}) {
  const { first, last } = splitName(fighter.name);
  const age = ageOf(fighter.id);
  const meta = [fighter.record, age !== null ? `${age} yrs` : null].filter(Boolean).join(" · ");
  const alignCls = align === "left" ? "items-start text-left" : "items-end text-right";
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${alignCls}`}>
      <div className={`mb-1 flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.2em] ${tone === "red" ? "text-red" : "text-blue"}`}>
        {align === "right" && <span className="h-px w-5 bg-blue/50" />}
        {tone} corner
        {align === "left" && <span className="h-px w-5 bg-red/50" />}
      </div>
      <div className="-mx-[15px] -my-[15px] scale-75 sm:m-0 sm:scale-100">
        <FighterFace id={fighter.id} name={fighter.name} size={120} tone={tone} />
      </div>
      <div className="min-w-0">
        <div className="display text-sm font-semibold text-muted leading-none">{first}&nbsp;</div>
        <Link
          href={fighter.id ? `/ufc/fighter/${fighter.id}` : "#"}
          className="display block truncate text-3xl font-extrabold leading-[0.9] text-zinc-100 hover:text-accent sm:text-5xl"
        >
          {last}
        </Link>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-muted tabnums">
        {fighter.flag && <img src={fighter.flag} alt="" width={16} height={11} className="rounded-[1px]" />}
        <span>{meta}</span>
      </div>
      <div className={`display text-2xl font-bold tabnums ${tone === "red" ? "text-red" : "text-blue"}`}>
        {probs.b !== null ? <TriProb c={probs.c} m={probs.m} b={probs.b} /> : pct(probs.m)}
      </div>
    </div>
  );
}

export default function FaceOff({ fight, label, eventId }: { fight: FightForecast; label?: string; eventId?: string }) {
  const book = getBookLine(fight.boutId);
  const { p: pA, blended } = consensusPA(fight);
  const gap = book ? fight.pA - book.pA : 0;
  const value = book && Math.abs(gap) >= VALUE_GAP ? (gap > 0 ? fight.a.name : fight.b.name) : null;

  const probsA = { c: pA, m: fight.pA, b: book?.pA ?? null };
  const probsB = { c: 1 - pA, m: 1 - fight.pA, b: book ? 1 - book.pA : null };
  return (
    <div id={`bout-${fight.boutId}`} className="terminal-panel terminal-panel--fight group scroll-mt-20" data-view="cons">
      <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[9px] uppercase tracking-[0.2em] text-muted sm:px-6">
        <span className="flex items-center gap-2 whitespace-nowrap text-accent">
          <span className="signal-dot ufc-signal-dot" />
          {label ?? "Main event signal"}
        </span>
        <span className="flex items-center gap-2 tabnums">
          {eventId && (
            <LiveBadge eventId={eventId} boutId={fight.boutId} fightDate={fight.date} />
          )}
          {blended ? "" : "model · "}
          {fight.weightClass ?? ""}
          {book && <ViewToggle />}
        </span>
      </div>

      <div className="relative p-5 sm:p-7">
        <div className="pointer-events-none absolute inset-x-[18%] top-1/2 h-40 -translate-y-1/2 bg-[radial-gradient(ellipse,rgba(255,255,255,0.035),transparent_68%)]" />
        {eventId && (
          <ResultBanner
            eventId={eventId}
            boutId={fight.boutId}
            fightDate={fight.date}
            aId={fight.a.id}
            aName={fight.a.name}
            bName={fight.b.name}
            pA={pA}
          />
        )}
        <div className="relative grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2 sm:gap-8">
          <Corner fighter={fight.a} probs={probsA} tone="red" align="left" />
          <div className="self-center pt-14 text-center">
            <div className="display flex h-12 w-12 items-center justify-center rounded-full border border-line bg-bg text-xl font-extrabold text-zinc-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] sm:h-16 sm:w-16 sm:text-3xl">
              VS
            </div>
            <div className="mt-2 text-[7px] uppercase tracking-[0.2em] text-zinc-700">matchup</div>
          </div>
          <Corner fighter={fight.b} probs={probsB} tone="blue" align="right" />
        </div>

        <div className="relative mt-7 flex flex-col">
          <div className="mb-1.5 flex items-center justify-between text-[8px] uppercase tracking-[0.18em] text-zinc-600">
            <span>{splitName(fight.a.name).last}</span>
            <span>Win probability</span>
            <span>{splitName(fight.b.name).last}</span>
          </div>
          {book ? (
            <TriBar c={pA} m={fight.pA} b={book.pA} h="h-3" />
          ) : (
            <div className="flex h-3 overflow-hidden rounded-sm bg-zinc-900">
              <div className="bg-red" style={{ width: pct(pA) }} />
              <div className="bg-blue flex-1" />
            </div>
          )}
        </div>

        {fight.method && (
          <div className="mt-2">
            <MethodChips method={fight.method} />
          </div>
        )}

        {book && (
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[11px] tabnums">
            <span className="text-muted">
              model {pct(fight.pA)} · books {pct(book.pA)}
              <span className="text-zinc-600"> ({book.books} bks) · consensus = 50/50</span>
            </span>
            {value && (
              <span className="whitespace-nowrap rounded border border-warn/50 px-1.5 py-0.5 uppercase tracking-wider text-warn">
                value {splitName(value).last} +{Math.round(Math.abs(gap) * 100)}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="terminal-kpi-grid grid grid-cols-3 gap-px rounded-none border-x-0 border-b-0">
        <div className="terminal-kpi px-3 py-3 sm:px-5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Consensus</div>
          <div className="display mt-1 text-lg font-bold text-zinc-100 tabnums sm:text-2xl">{pct(pA)}</div>
          <div className="mt-0.5 truncate text-[8px] uppercase tracking-[0.1em] text-zinc-600">{splitName(fight.a.name).last}</div>
        </div>
        <div className="terminal-kpi px-3 py-3 sm:px-5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Model</div>
          <div className="display mt-1 text-lg font-bold text-red tabnums sm:text-2xl">{pct(fight.pA)}</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">red corner</div>
        </div>
        <div className="terminal-kpi px-3 py-3 sm:px-5">
          <div className="text-[8px] uppercase tracking-[0.16em] text-muted">Books</div>
          <div className="display mt-1 text-lg font-bold text-blue tabnums sm:text-2xl">{book ? pct(book.pA) : "—"}</div>
          <div className="mt-0.5 text-[8px] uppercase tracking-[0.1em] text-zinc-600">market line</div>
        </div>
      </div>
      {eventId && (
        <FightStats
          eventId={eventId}
          boutId={fight.boutId}
          fightDate={fight.date}
          aId={fight.a.id}
          bId={fight.b.id}
        />
      )}
    </div>
  );
}
