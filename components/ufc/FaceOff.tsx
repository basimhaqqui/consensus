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
    <div className={`flex flex-col gap-2 ${alignCls} min-w-0`}>
      <FighterFace id={fighter.id} name={fighter.name} size={120} tone={tone} />
      <div className="min-w-0">
        <div className="display text-sm font-semibold text-muted leading-none">{first}&nbsp;</div>
        <Link
          href={fighter.id ? `/ufc/fighter/${fighter.id}` : "#"}
          className="display block text-3xl sm:text-5xl font-extrabold leading-[0.95] truncate hover:text-accent"
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
    <div id={`bout-${fight.boutId}`} className="terminal-panel terminal-panel--fight group scroll-mt-4" data-view="cons">
      <div className="terminal-panel-header flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted">
        <span className="text-accent whitespace-nowrap">{label ?? "Main event"}</span>
        <span className="flex items-center gap-2">
          {eventId && (
            <LiveBadge eventId={eventId} boutId={fight.boutId} fightDate={fight.date} />
          )}
          {blended ? "" : "model · "}
          {fight.weightClass ?? ""}
          {book && <ViewToggle />}
        </span>
      </div>

      <div className="p-5 sm:p-6">
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
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 sm:gap-6">
          <Corner fighter={fight.a} probs={probsA} tone="red" align="left" />
          <div className="display self-center text-2xl sm:text-4xl font-extrabold text-zinc-700 pt-8">
            VS
          </div>
          <Corner fighter={fight.b} probs={probsB} tone="blue" align="right" />
        </div>

        <div className="mt-5 flex flex-col">
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
