import Link from "next/link";
import {
  COMPETITIONS,
  getLeagueScoreboard,
  type Competition,
  type LeagueMatch,
} from "@/lib/leagues";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";

export const dynamic = "force-dynamic";

export default async function Landing() {
  // pull every competition's scoreboard in parallel; surface live + next games
  const boards = await Promise.all(
    COMPETITIONS.map((c) =>
      getLeagueScoreboard(c.slug).then((b) => ({ c, b }))
    )
  );

  const live: { c: Competition; m: LeagueMatch }[] = [];
  const counts = new Map<string, { live: number; total: number }>();
  for (const { c, b } of boards) {
    const ms = b?.matches ?? [];
    const liveMs = ms.filter((m) => m.status === "in");
    counts.set(c.slug, { live: liveMs.length, total: ms.length });
    liveMs.forEach((m) => live.push({ c, m }));
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 pb-20">
      {/* hero */}
      <header className="pt-16 pb-10 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight flex items-center justify-center gap-3">
          <span className="text-accent">▸</span> CONSENSUS
        </h1>
        <p className="mt-4 text-base sm:text-lg text-muted max-w-2xl mx-auto">
          A football intelligence terminal. Live scores, lineups, match stats,
          and player cards across every major competition — plus our own model
          for the World Cup.
        </p>
        <div className="mt-3 text-[11px] uppercase tracking-[0.2em] text-zinc-600">
          Live · ESPN data · our own Elo model
        </div>
      </header>

      {/* live now */}
      {live.length > 0 && (
        <section className="mb-10">
          <div className="mb-3 flex items-center gap-3">
            <h2 className="text-[11px] uppercase tracking-[0.2em] text-accent flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              Live now
            </h2>
            <span className="text-[11px] text-muted">[{live.length}]</span>
            <span className="flex-1 h-px bg-line" />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {live.slice(0, 6).map(({ c, m }) => (
              <LiveMatch key={m.id} comp={c} m={m} />
            ))}
          </div>
        </section>
      )}

      {/* competitions */}
      <section>
        <div className="mb-3 flex items-center gap-3">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-zinc-400">
            Competitions
          </h2>
          <span className="flex-1 h-px bg-line" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITIONS.map((c) => {
            const ct = counts.get(c.slug);
            const href = c.slug === "fifa.world" ? "/wc" : `/league/${c.slug}`;
            return (
              <Link
                key={c.slug}
                href={href}
                className="rounded-xl border border-line bg-panel/70 card-shadow lift p-4 flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold flex items-center gap-2">
                    {c.name}
                    {c.slug === "fifa.world" && (
                      <span className="text-[9px] uppercase tracking-wider text-accent border border-accent/40 rounded px-1 py-px">
                        model
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-[11px] text-muted">
                    {ct?.live
                      ? `${ct.live} live now`
                      : ct?.total
                      ? `${ct.total} fixtures`
                      : "off-season"}
                  </div>
                </div>
                <span className="text-muted">→</span>
              </Link>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}

function LiveMatch({ comp, m }: { comp: Competition; m: LeagueMatch }) {
  return (
    <Link
      href={`/m/${comp.slug}/${m.id}`}
      className="block rounded-lg border border-accent/50 bg-panel/80 card-shadow lift p-3"
    >
      <div className="mb-1.5 flex items-center justify-between text-[10px] uppercase tracking-wider">
        <span className="text-muted">{comp.short}</span>
        <span className="text-accent flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          {m.detail}
        </span>
      </div>
      <Row name={m.home.name} logo={m.home.logo} score={m.home.score} />
      <Row name={m.away.name} logo={m.away.logo} score={m.away.score} />
    </Link>
  );
}

function Row({
  name,
  logo,
  score,
}: {
  name: string;
  logo?: string;
  score?: string;
}) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Crest src={logo} code={name} size={18} className="w-5" />
      <span className="flex-1 truncate text-sm">{name}</span>
      <span className="tabnums text-sm font-semibold w-5 text-right">{score}</span>
    </div>
  );
}
