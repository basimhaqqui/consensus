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
    <div>
      <header className="site-header">
        <div className="site-kicker">01 / Combat intelligence</div>
        <h1 className="site-title">UFC Consensus</h1>
        <p className="site-subtitle">
          A fight terminal. An independent fighter model, the de-vigged book
          line, and the 50/50 consensus of the two for every upcoming UFC bout —
          every forecast frozen pre-fight and graded in public.
        </p>
        <div className="mt-4 text-[9px] uppercase tracking-[0.18em] text-zinc-600 tabnums">
          Fighter Elo · 9,000+ fights replayed · updated {computedAt.slice(0, 10)}
        </div>
      </header>

      {next && mainEvent && (
        <section className="mt-10 mb-12">
          <div className="section-heading section-heading--live" data-index="02">
            <h2>Next event</h2>
            <span className="text-[11px] text-muted">[{next.fights.length}]</span>
          </div>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h3 className="site-title site-title--small">{next.name}</h3>
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
              className="rounded-[7px] border border-accent/40 bg-accent/10 px-3 py-1.5 text-[9px] uppercase tracking-[0.14em] text-accent hover:-translate-y-0.5 hover:border-accent/70 hover:bg-accent/15"
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
                <div className="section-heading" data-index="03">
                  <h2>Upcoming fight boards</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {cards.map((c) => (
                    <Link
                      key={c.eventId}
                      href={`/ufc/event/${c.eventId}`}
                      className="terminal-panel terminal-panel--interactive px-4 py-3"
                    >
                      <div className="display truncate text-lg font-extrabold">
                        {splitName(c.fights.at(-1)?.a.name ?? null).last}
                        <span className="text-zinc-600"> vs </span>
                        {splitName(c.fights.at(-1)?.b.name ?? null).last}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-muted tabnums">
                        {c.name.split(":")[0]}
                        {" · "}
                        {new Date(c.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          timeZone: "UTC",
                        })}
                        {" · "}
                        {c.fights.length} confirmed {c.fights.length === 1 ? "fight" : "fights"}
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
                <div className="section-heading" data-index="03">
                  <h2>Pound-for-pound signal</h2>
                </div>
                <p className="mb-3 max-w-3xl text-xs leading-relaxed text-muted">
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
                        <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400">
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

      <footer className="terminal-panel mt-14 p-5 text-[11px] leading-relaxed text-zinc-600">
        Model output only — not betting advice. Ratings come from an online Elo
        replay of the full UFC record with age, layoff, and finish adjustments,
        validated out-of-sample before anything ships.
      </footer>
    </div>
  );
}
