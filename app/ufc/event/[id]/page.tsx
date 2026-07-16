import Link from "next/link";
import { notFound } from "next/navigation";
import FaceOff from "@/components/ufc/FaceOff";
import FightCard from "@/components/ufc/FightCard";
import LiveNowBar from "@/components/ufc/LiveNowBar";
import BetLab from "@/components/ufc/BetLab";
import Predictor from "@/components/ufc/Predictor";
import Tabs from "@/components/ufc/Tabs";
import { consensusPA, getBookLine } from "@/lib/ufc/data";
import { getCard, getCards, type FightForecast } from "@/lib/ufc/data";

export function generateStaticParams() {
  return getCards().map((c) => ({ id: c.eventId }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = getCard(id);
  return { title: card ? `${card.name} — UFC CONSENSUS` : "UFC CONSENSUS" };
}

const SEGMENT_ORDER = ["Main Card", "Prelims", "Early Prelims"];

function segmented(fights: FightForecast[]): { title: string; fights: FightForecast[] }[] {
  const hasSegments = fights.some((f) => f.segment && f.matchNumber);
  if (!hasSegments) {
    // ESPN lists cards prelims-first; show the main card top-down.
    return [{ title: "Fight board", fights: [...fights].reverse() }];
  }
  const groups = new Map<string, FightForecast[]>();
  for (const f of fights) {
    const key = f.segment ?? "Card";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(f);
  }
  const rank = (t: string) => {
    const i = SEGMENT_ORDER.indexOf(t);
    return i === -1 ? 50 : i;
  };
  return [...groups.entries()]
    .sort((x, y) => rank(x[0]) - rank(y[0]))
    .map(([title, fs]) => ({
      title,
      fights: fs.sort((a, b) => (a.matchNumber ?? 99) - (b.matchNumber ?? 99)),
    }));
}

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = getCard(id);
  if (!card) notFound();

  const sections = segmented(card.fights);
  const mainEvent = sections[0]?.fights[0];
  const rest = sections.map((s, i) => ({
    ...s,
    fights: i === 0 ? s.fights.slice(1) : s.fights,
  }));

  const ordered = [...card.fights].sort((a, b) => (a.matchNumber ?? 99) - (b.matchNumber ?? 99));
  const eventDate = new Date(card.date);
  const eventDay = eventDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const eventWeekday = eventDate.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });

  const cardPane = (
    <>
      {rest.map(
        (s, sectionIndex) =>
          s.fights.length > 0 && (
            <section key={s.title} className="mt-8">
              <div
                className="section-heading"
                data-index={String(sectionIndex + 3).padStart(2, "0")}
              >
                <h2>{s.title}</h2>
                <span className="text-[10px] uppercase tracking-[0.14em] text-muted tabnums">
                  {s.fights.length} {s.fights.length === 1 ? "bout" : "bouts"}
                </span>
              </div>
              <div className="grid gap-3 lg:grid-cols-2">
                {s.fights.map((f) => (
                  <FightCard key={f.boutId} fight={f} eventId={card.eventId} />
                ))}
              </div>
            </section>
          )
      )}
    </>
  );

  const predictorPane = (
    <Predictor
      eventId={card.eventId}
      eventName={card.name}
      fights={ordered.map((f) => ({
        boutId: f.boutId,
        date: f.date,
        a: f.a,
        b: f.b,
        pA: f.pA,
        method: f.method ?? null,
        fiveRounds: f.matchNumber === 1,
      }))}
    />
  );

  const betLabPane = (
    <BetLab
      eventId={card.eventId}
      fights={ordered.map((f) => ({
        boutId: f.boutId,
        date: f.date,
        aName: f.a.name,
        bName: f.b.name,
        pA: f.pA,
        bookPA: getBookLine(f.boutId)?.pA ?? null,
        method: f.method ?? null,
        fiveRounds: f.matchNumber === 1,
        ratingA: f.ratingA,
        ratingB: f.ratingB,
        fightsA: f.fightsA,
        fightsB: f.fightsB,
      }))}
    />
  );

  return (
    <div>
      <header className="site-header site-header--compact">
        <Link href="/ufc" className="back-link mb-7">
          <span aria-hidden="true">←</span> UFC desk
        </Link>

        <div className="section-heading" data-index="01">
          <h2>Event command</h2>
          <span className="hidden text-[10px] text-zinc-600 sm:inline">fight-night intelligence / {card.eventId}</span>
        </div>

        <div className="terminal-panel">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-px bg-gradient-to-b from-transparent via-red to-transparent opacity-80" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-px bg-gradient-to-b from-transparent via-blue to-transparent opacity-70" />
          <div className="terminal-panel-header flex items-center justify-between gap-4 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-muted sm:px-6">
            <span className="flex items-center gap-2 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-red shadow-[0_0_12px_rgba(239,68,68,0.7)]" />
              Fight night dossier
            </span>
            <span className="tabnums">UFC / forecast active</span>
          </div>

          <div className="relative overflow-hidden px-5 py-7 sm:px-7 sm:py-9">
            <div className="pointer-events-none absolute -left-20 top-1/2 h-60 w-60 -translate-y-1/2 bg-[radial-gradient(circle,rgba(239,68,68,0.1),transparent_68%)]" />
            <div className="pointer-events-none absolute -right-20 top-1/2 h-60 w-60 -translate-y-1/2 bg-[radial-gradient(circle,rgba(59,130,246,0.1),transparent_68%)]" />
            <div className="relative max-w-4xl">
              <div className="mb-3 text-[10px] uppercase tracking-[0.22em] text-accent">
                Independent event forecast
              </div>
              <h1 className="site-title text-[clamp(2.35rem,7vw,5.25rem)] leading-[0.9] tracking-[-0.055em]">
                {card.name}
              </h1>
              <p className="mt-4 max-w-2xl text-[11px] leading-relaxed text-muted sm:text-xs">
                Model signal, market pricing, and live bout status assembled into one fight-night board.
              </p>
            </div>
          </div>

          <div className="terminal-kpi-grid grid grid-cols-2 gap-px rounded-none border-x-0 border-b-0 sm:grid-cols-3">
            <div className="terminal-kpi px-4 py-3.5 sm:px-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Event date</div>
              <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums sm:text-3xl">{eventDay}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                {eventWeekday} / {eventDate.getUTCFullYear()}
              </div>
            </div>
            <div className="terminal-kpi px-4 py-3.5 sm:px-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Fight count</div>
              <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums sm:text-3xl">{card.fights.length}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">scheduled bouts</div>
            </div>
            <div className="terminal-kpi px-4 py-3.5 sm:px-5">
              <div className="text-[10px] uppercase tracking-[0.18em] text-muted">Signal</div>
              <div className="display mt-1 text-2xl font-bold text-red sm:text-3xl">Consensus</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-zinc-600">model + market</div>
            </div>
          </div>
        </div>
      </header>

      {mainEvent && (
        <section className="mb-5 mt-10">
          <div className="section-heading section-heading--live" data-index="02">
            <h2>Main event</h2>
            <span className="text-[10px] uppercase tracking-[0.14em] text-muted">headline consensus</span>
          </div>
          <FaceOff fight={mainEvent} eventId={card.eventId} />
        </section>
      )}

      <LiveNowBar
        eventId={card.eventId}
        fights={card.fights.map((f) => ({
          boutId: f.boutId,
          date: f.date,
          aName: f.a.name,
          bName: f.b.name,
          pA: consensusPA(f).p,
        }))}
      />

      <Tabs
        anchorPrefix="#bout-"
        anchorTab="card"
        tabs={[
          { key: "card", label: "Fight Card", badge: `${card.fights.length}`, content: cardPane },
          { key: "predictor", label: "Predictor", content: predictorPane },
          { key: "betlab", label: "Bet Lab", content: betLabPane },
        ]}
      />

      <footer className="terminal-panel mt-12">
        <div className="terminal-panel-header px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted sm:px-5">
          Methodology / disclosure
        </div>
        <p className="p-5 text-[11px] leading-relaxed text-zinc-600">
          Probabilities are the model&apos;s alone — an online Elo replay of every UFC fight since
          1993 with age, layoff, and finish adjustments. Fighters marked{" "}
          <span className="text-zinc-400">prov</span> have fewer than five UFC fights and carry
          provisional ratings. Not betting advice.
        </p>
      </footer>
    </div>
  );
}
