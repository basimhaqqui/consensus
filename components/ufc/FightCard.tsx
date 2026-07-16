import Link from "next/link";
import FighterFace from "@/components/ufc/FighterFace";
import { splitName } from "@/components/ufc/FaceOff";
import { MethodChips, TriBar, TriProb } from "@/components/ufc/Tri";
import ViewToggle from "@/components/ufc/ViewToggle";
import LiveBadge from "@/components/ufc/LiveBadge";
import ResultBanner from "@/components/ufc/ResultBanner";
import FightStats from "@/components/ufc/FightStats";
import { ageOf, consensusPA, ftIn, getBio, getBookLine, VALUE_GAP, type FightForecast, type FighterRef } from "@/lib/ufc/data";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Side({
  fighter,
  probs,
  fights,
  tone,
  align,
}: {
  fighter: FighterRef;
  probs: { c: number; m: number; b: number | null };
  fights: number;
  tone: "red" | "blue";
  align: "left" | "right";
}) {
  const { first, last } = splitName(fighter.name);
  const bio = getBio(fighter.id);
  const age = ageOf(fighter.id);
  const tape = [
    fighter.record,
    age !== null ? `${age}` : null,
    ftIn(bio?.height),
    bio?.reach ? `${bio.reach}"` : null,
    fights < 5 ? "prov" : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const right = align === "right";
  return (
    <div className={`flex min-w-0 items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <div className="relative">
        <FighterFace id={fighter.id} name={fighter.name} size={58} tone={tone} />
        <span
          className={`absolute -bottom-1 ${right ? "-right-1" : "-left-1"} rounded border bg-bg px-1 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${
            tone === "red" ? "border-red/40 text-red" : "border-blue/40 text-blue"
          }`}
        >
          {tone}
        </span>
      </div>
      <div className="min-w-0">
        <div className="display text-[10px] font-semibold leading-none text-muted">{first}&nbsp;</div>
        <Link
          href={fighter.id ? `/ufc/fighter/${fighter.id}` : "#"}
          className="display block truncate text-2xl font-extrabold leading-none text-zinc-100 hover:text-accent"
        >
          {last}
        </Link>
        <div className={`mt-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.08em] text-muted tabnums ${right ? "justify-end" : ""}`}>
          {fighter.flag && !right && <img src={fighter.flag} alt="" width={13} height={9} className="rounded-[1px]" />}
          <span className="truncate">{tape}</span>
          {fighter.flag && right && <img src={fighter.flag} alt="" width={13} height={9} className="rounded-[1px]" />}
        </div>
      </div>
      <div className={`${right ? "mr-auto" : "ml-auto"} shrink-0 text-center`}>
        <div className={`display text-xl font-extrabold tabnums sm:text-2xl ${tone === "red" ? "text-red" : "text-blue"}`}>
          {probs.b !== null ? <TriProb c={probs.c} m={probs.m} b={probs.b} /> : pct(probs.m)}
        </div>
        <div className="mt-0.5 text-[10px] uppercase tracking-[0.15em] text-zinc-600">win prob</div>
      </div>
    </div>
  );
}

export default function FightCard({ fight, eventId }: { fight: FightForecast; eventId?: string }) {
  const book = getBookLine(fight.boutId);
  const { p: pA } = consensusPA(fight);
  const gap = book ? fight.pA - book.pA : 0;
  const value = book && Math.abs(gap) >= VALUE_GAP ? (gap > 0 ? fight.a.name : fight.b.name) : null;
  const pAHdr = pA;
  const probsA = { c: pA, m: fight.pA, b: book?.pA ?? null };
  const probsB = { c: 1 - pA, m: 1 - fight.pA, b: book ? 1 - book.pA : null };
  return (
    <article id={`bout-${fight.boutId}`} className="terminal-panel terminal-panel--fight terminal-panel--interactive group scroll-mt-20" data-view="cons">
      <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-[10px] uppercase tracking-[0.18em] text-muted">
        <span className="flex items-center gap-2">
          <span className="text-zinc-400">Bout {fight.matchNumber ?? "—"}</span>
          <span className="text-zinc-700">/</span>
          <span>{fight.weightClass ?? "TBA"}</span>
        </span>
        <span className="flex items-center gap-2 tabnums">
          {eventId && (
            <LiveBadge eventId={eventId} boutId={fight.boutId} fightDate={fight.date} />
          )}
          {new Date(fight.date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          })}
          {book && <ViewToggle />}
        </span>
      </div>
      <div className="space-y-3.5 p-4 sm:p-5">
        {eventId && (
          <ResultBanner
            eventId={eventId}
            boutId={fight.boutId}
            fightDate={fight.date}
            aId={fight.a.id}
            aName={fight.a.name}
            bName={fight.b.name}
            pA={pAHdr}
          />
        )}
        <Side fighter={fight.a} probs={probsA} fights={fight.fightsA} tone="red" align="left" />
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            <span>Red corner</span>
            <span>Probability signal</span>
            <span>Blue corner</span>
          </div>
          {book ? (
            <TriBar c={pA} m={fight.pA} b={book.pA} h="h-2.5" />
          ) : (
            <div className="flex h-2.5 overflow-hidden rounded-sm bg-zinc-900">
              <div className="bg-red/90" style={{ width: pct(pA) }} />
              <div className="flex-1 bg-blue/80" />
            </div>
          )}
        </div>
        <Side fighter={fight.b} probs={probsB} fights={fight.fightsB} tone="blue" align="right" />
        {fight.method && <MethodChips method={fight.method} />}
      </div>
      {book && (
        <div className="terminal-panel-header flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 text-[10px] uppercase tracking-[0.1em] tabnums">
          <span className="text-muted">
            model <span className="text-zinc-300">{pct(fight.pA)}</span> · books <span className="text-zinc-300">{pct(book.pA)}</span>
            <span className="text-zinc-600"> · {book.books} books</span>
          </span>
          {value && (
            <span className="whitespace-nowrap rounded border border-warn/50 px-1.5 py-0.5 uppercase tracking-wider text-warn">
              value {splitName(value).last} +{Math.round(Math.abs(gap) * 100)}
            </span>
          )}
        </div>
      )}
      {eventId && (
        <FightStats
          eventId={eventId}
          boutId={fight.boutId}
          fightDate={fight.date}
          aId={fight.a.id}
          bId={fight.b.id}
        />
      )}
    </article>
  );
}
