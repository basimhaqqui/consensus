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
    <div className={`flex items-center gap-2.5 min-w-0 ${right ? "flex-row-reverse text-right" : ""}`}>
      <FighterFace id={fighter.id} name={fighter.name} size={52} tone={tone} />
      <div className="min-w-0">
        <div className="display text-[11px] font-semibold text-muted leading-none">{first}&nbsp;</div>
        <Link
          href={fighter.id ? `/ufc/fighter/${fighter.id}` : "#"}
          className="display block text-xl font-extrabold leading-tight truncate hover:text-accent"
        >
          {last}
        </Link>
        <div className="text-[10px] text-muted tabnums truncate flex items-center gap-1">
          {fighter.flag && !right && <img src={fighter.flag} alt="" width={13} height={9} className="rounded-[1px]" />}
          <span className="truncate">{tape}</span>
          {fighter.flag && right && <img src={fighter.flag} alt="" width={13} height={9} className="rounded-[1px]" />}
        </div>
      </div>
      <div className={`${right ? "mr-auto" : "ml-auto"} shrink-0 display text-lg font-bold tabnums ${tone === "red" ? "text-red" : "text-blue"}`}>
        {probs.b !== null ? <TriProb c={probs.c} m={probs.m} b={probs.b} /> : pct(probs.m)}
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
    <article id={`bout-${fight.boutId}`} className="group scroll-mt-4 rounded-xl border border-line bg-panel/80 card-shadow overflow-hidden" data-view="cons">
      <div className="flex items-center justify-between border-b border-line bg-panel2/60 px-4 py-1.5 text-[11px] uppercase tracking-wider text-muted">
        <span>{fight.weightClass ?? "TBA"}</span>
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
      <div className="p-4 space-y-2.5">
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
        {book ? (
          <TriBar c={pA} m={fight.pA} b={book.pA} h="h-2" />
        ) : (
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-900">
            <div className="bg-red/90" style={{ width: pct(pA) }} />
            <div className="bg-blue/80 flex-1" />
          </div>
        )}
        <Side fighter={fight.b} probs={probsB} fights={fight.fightsB} tone="blue" align="right" />
        {fight.method && <MethodChips method={fight.method} />}
      </div>
      {book && (
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line bg-panel2/40 px-4 py-1.5 text-[11px] tabnums">
          <span className="text-muted">
            model {pct(fight.pA)} · books {pct(book.pA)}
            <span className="text-zinc-600"> · {book.books} bks</span>
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
