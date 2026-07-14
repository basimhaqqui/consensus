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

  const cardPane = (
    <>
      {rest.map(
        (s, sectionIndex) =>
          s.fights.length > 0 && (
            <section key={s.title} className="mt-6">
              <div
                className="section-heading"
                data-index={String(sectionIndex + 3).padStart(2, "0")}
              >
                <h2>{s.title}</h2>
                <span className="text-[11px] text-muted">[{s.fights.length}]</span>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
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
        <Link href="/ufc" className="back-link">
          ← UFC desk
        </Link>
        <div className="site-kicker mt-6">01 / Event forecast</div>
        <h1 className="site-title site-title--small">
          {card.name}
        </h1>
        <div className="mt-2 text-sm text-muted tabnums">
          {new Date(card.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
            timeZone: "UTC",
          })}
          {" · "}
          {card.fights.length} fights
        </div>
      </header>

      {mainEvent && (
        <section className="mt-10 mb-4">
          <div className="section-heading section-heading--live" data-index="02">
            <h2>Main event consensus</h2>
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

      <footer className="terminal-panel mt-12 p-5 text-xs leading-relaxed text-muted">
        Probabilities are the model&apos;s alone — an online Elo replay of every UFC fight since
        1993 with age, layoff, and finish adjustments. Fighters marked{" "}
        <span className="text-zinc-400">prov</span> have fewer than five UFC fights and carry
        provisional ratings. Not betting advice.
      </footer>
    </div>
  );
}
