import Link from "next/link";
import FaceOff, { splitName } from "@/components/ufc/FaceOff";
import FighterFace from "@/components/ufc/FighterFace";
import LedgerPanel from "@/components/ufc/LedgerPanel";
import LiveNowBar from "@/components/ufc/LiveNowBar";
import RankList from "@/components/ufc/RankList";
import Tabs from "@/components/ufc/Tabs";
import { computedAt, consensusPA, getCards, getUfcRankings } from "@/lib/ufc/data";

export default function Home() {
  const cards = getCards();
  const next = cards[0];
  const mainEvent = next?.fights.at(-1);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      <header className="pt-14 pb-10 text-center">
        <h1 className="display text-5xl sm:text-7xl font-extrabold tracking-tight flex items-center justify-center gap-3">
          <span className="text-accent">▸</span> UFC CONSENSUS
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted max-w-2xl mx-auto">
          A fight terminal. An independent fighter model, the de-vigged book
          line, and the 50/50 consensus of the two for every upcoming UFC bout —
          every forecast frozen pre-fight and graded in public.
        </p>
        <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-zinc-600 tabnums">
          Fighter Elo · 9,000+ fights replayed · updated {computedAt.slice(0, 10)}
        </div>
      </header>

      {next && mainEvent && (
        <section className="mb-12">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-accent">
              Next event
            </h2>
            <span className="flex-1 h-px bg-line" />
          </div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="display text-2xl sm:text-3xl font-extrabold">{next.name}</h3>
              <div className="mt-1 text-xs text-muted tabnums">
                {new Date(next.date).toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "long",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                {" · "}
                {next.fights.length} fights
              </div>
            </div>
            <Link
              href={`/ufc/event/${next.eventId}`}
              className="rounded-lg border border-accent/40 px-4 py-2 text-sm text-accent hover:bg-accent/10"
            >
              Full card →
            </Link>
          </div>
          <FaceOff fight={mainEvent} eventId={next.eventId} />
          <LiveNowBar
            eventId={next.eventId}
            fights={next.fights.map((f) => ({
              boutId: f.boutId,
              date: f.date,
              aName: f.a.name,
              bName: f.b.name,
              pA: consensusPA(f).p,
            }))}
          />
        </section>
      )}

      <Tabs
        tabs={[
          {
            key: "upcoming",
            label: "Upcoming",
            badge: `${cards.length}`,
            content: (
              <section className="mt-6">
        <div className="grid gap-2 sm:grid-cols-2">
          {cards.map((c) => (
            <Link
              key={c.eventId}
              href={`/ufc/event/${c.eventId}`}
              className="rounded-lg border border-line bg-panel/60 px-4 py-3 hover:border-accent/40 hover:bg-panel"
            >
              <div className="display text-lg font-extrabold truncate">
                {splitName(c.fights.at(-1)?.a.name ?? null).last}
                <span className="text-zinc-600"> vs </span>
                {splitName(c.fights.at(-1)?.b.name ?? null).last}
              </div>
              <div className="mt-1 text-[11px] text-muted tabnums truncate">
                {c.name.split(":")[0]}
                {" · "}
                {new Date(c.date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  timeZone: "UTC",
                })}
                {" · "}
                {c.fights.length} fights
              </div>
            </Link>
          ))}
        </div>
              </section>
            ),
          },
          {
            key: "p4p",
            label: "P4P",
            content: (
              <section className="mt-6">
                <p className="mb-3 text-xs text-muted leading-relaxed max-w-3xl">
                  The UFC&apos;s official pound-for-pound rankings, with our model&apos;s Elo
                  beside each name — where the panel and the math disagree is where it gets
                  interesting.{" "}
                  <Link href="/ufc/rankings" className="text-accent hover:underline">
                    All divisions →
                  </Link>
                </p>
                <div className="grid gap-4 lg:grid-cols-2">
                  {getUfcRankings()
                    .divisions.filter((d) => d.p4p)
                    .map((d) => (
                      <div key={d.name}>
                        <h3 className="display mb-2 text-base font-extrabold text-zinc-300">
                          {d.name.replace(" Rankings", "")}
                        </h3>
                        <RankList ranks={d.ranks} limit={10} />
                      </div>
                    ))}
                </div>
              </section>
            ),
          },
          {
            key: "ledger",
            label: "Ledger",
            content: (
              <div className="mt-6">
                <LedgerPanel />
              </div>
            ),
          },
        ]}
      />

      <footer className="mt-14 border-t border-line pt-5 text-[11px] text-zinc-600 leading-relaxed">
        Model output only — not betting advice. Ratings come from an online Elo
        replay of the full UFC record with age, layoff, and finish adjustments,
        validated out-of-sample before anything ships.
      </footer>
    </div>
  );
}
