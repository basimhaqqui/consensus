import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ClubMovementPanel from "@/components/ClubMovementPanel";
import CompetitionNav from "@/components/CompetitionNav";
import Crest from "@/components/Crest";
import Footer from "@/components/Footer";
import PlayerFace from "@/components/PlayerFace";
import WatchlistButton from "@/components/WatchlistButton";
import { getClubPageData, type ClubFixtureForecast, type ClubPlayer } from "@/lib/club";
import type { LeagueMatch } from "@/lib/leagues";

export const dynamic = "force-dynamic";

type ClubPageProps = {
  params: Promise<{ league: string; abbr: string }>;
};

export async function generateMetadata({ params }: ClubPageProps): Promise<Metadata> {
  const { league, abbr } = await params;
  const data = await getClubPageData(league, abbr);
  if (!data) return { title: "Club not found · CONSENSUS" };
  return {
    title: `${data.team.name} command center · CONSENSUS`,
    description: `${data.team.name} fixtures, forecasts, table position, season projection and squad leaders.`,
  };
}

export default async function ClubPage({ params }: ClubPageProps) {
  const { league, abbr } = await params;
  const data = await getClubPageData(league, abbr);
  if (!data) notFound();

  const clubKey = `club:${league}:${data.team.abbr}`;
  const watchItem = {
    key: clubKey,
    kind: "club" as const,
    title: data.team.name,
    context: data.competition,
    href: `/club/${league}/${data.team.abbr}`,
    image: data.team.logo,
  };
  const nextForecast = data.forecasts[0];

  return (
    <main className="site-shell site-shell--compact">
      <div className="site-topbar">
        <Link href={`/league/${league}`} className="back-link">
          ← {data.competitionShort}
        </Link>
        <CompetitionNav active={league} />
      </div>

      <header
        className="relative mt-6 overflow-hidden rounded-[12px] border border-line bg-zinc-950 px-5 py-7 sm:px-7 sm:py-9"
        style={{
          backgroundImage: `radial-gradient(circle at 12% 20%, #${data.team.color}66, transparent 34%), radial-gradient(circle at 88% 0%, #${data.team.alternateColor}24, transparent 30%)`,
        }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[14px] border border-white/10 bg-black/35 shadow-2xl sm:h-24 sm:w-24">
              <Crest src={data.team.logo} code={data.team.abbr} size={76} className="h-16 w-16 sm:h-20 sm:w-20" />
            </div>
            <div className="min-w-0">
              <div className="site-kicker mb-2">Club command center · {data.competition}</div>
              <h1 className="display text-3xl font-bold leading-[0.98] tracking-tight text-zinc-50 sm:text-4xl">
                {data.team.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] uppercase tracking-[0.14em] text-muted">
                {data.season && <span>{data.season}</span>}
                {data.team.standingSummary && <span>{data.team.standingSummary}</span>}
                {data.team.recordSummary && <span>{data.team.recordSummary}</span>}
              </div>
            </div>
          </div>
          <WatchlistButton item={watchItem} />
        </div>

        <div className="relative mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-[9px] border border-white/[0.06] bg-white/[0.06] sm:grid-cols-4">
          <HeroStat label="Position" value={data.row ? `#${data.row.rank}` : "—"} detail={data.tableGroup?.name} />
          <HeroStat label="Points" value={data.row?.pts ?? "—"} detail={data.row ? `${data.row.gp} played` : undefined} />
          <HeroStat label="Record" value={data.row ? `${data.row.w}-${data.row.d}-${data.row.l}` : "—"} detail="W-D-L" />
          <HeroStat label="Club rating" value={data.rating ?? "—"} detail="Elo strength" />
        </div>
      </header>

      <section className="mt-9">
        <SectionHeading index="01" title="Decision desk" detail={data.upcoming.length ? `${data.upcoming.length} upcoming` : "Schedule pending"} />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
          {nextForecast ? (
            <NextFixture forecast={nextForecast} league={league} clubAbbr={data.team.abbr} />
          ) : data.upcoming[0] ? (
            <UpcomingCard match={data.upcoming[0]} league={league} clubAbbr={data.team.abbr} prominent />
          ) : (
            <div className="terminal-empty flex min-h-52 items-center px-5 py-8 text-xs text-muted">
              The next fixture has not been posted yet.
            </div>
          )}
          <ClubMovementPanel
            clubKey={clubKey}
            currentProbability={nextForecast?.marketProbability}
            books={nextForecast?.market?.books}
          />
        </div>
      </section>

      {data.forecasts.length > 0 && (
        <section className="mt-9">
          <SectionHeading index="02" title="Active reads" detail="Next three fixtures" />
          <div className="grid gap-3 md:grid-cols-3">
            {data.forecasts.map((forecast) => (
              <ForecastCard key={forecast.match.id} forecast={forecast} league={league} clubName={data.team.shortName} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div>
          <SectionHeading index="03" title="Fixtures & form" detail="UTC" />
          <div className="terminal-panel overflow-hidden">
            {data.recent.length > 0 && (
              <div className="border-b border-line/70">
                <div className="terminal-panel-header flex items-center justify-between px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted">
                  <span>Last five</span>
                  <FormStrip form={data.form} />
                </div>
                <div className="divide-y divide-line/50">
                  {data.recent.map((match) => (
                    <RecentRow key={match.id} match={match} league={league} clubAbbr={data.team.abbr} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <div className="terminal-panel-header px-4 py-2.5 text-[10px] uppercase tracking-[0.15em] text-muted">Next up</div>
              {data.upcoming.length > 0 ? (
                <div className="divide-y divide-line/50">
                  {data.upcoming.map((match) => (
                    <UpcomingRow key={match.id} match={match} league={league} clubAbbr={data.team.abbr} />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-[11px] text-muted">No future fixtures posted.</div>
              )}
            </div>
          </div>
        </div>

        <div>
          <SectionHeading index="04" title="Table context" detail={data.tableGroup?.name} />
          <div className="terminal-panel overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="terminal-panel-header text-[9px] uppercase tracking-[0.13em] text-muted">
                  <th className="px-3 py-2 text-left font-normal">#</th>
                  <th className="py-2 text-left font-normal">Club</th>
                  <th className="py-2 text-right font-normal">P</th>
                  <th className="py-2 text-right font-normal">GD</th>
                  <th className="py-2 pr-3 text-right font-normal">Pts</th>
                </tr>
              </thead>
              <tbody>
                {data.tableWindow.map((row) => {
                  const selected = row.abbr.toUpperCase() === data.team.abbr.toUpperCase();
                  return (
                    <tr key={row.abbr} className={`border-t border-line/50 ${selected ? "bg-accent/[0.07]" : "hover:bg-white/[0.018]"}`}>
                      <td className={`px-3 py-2.5 tabnums ${selected ? "text-accent" : "text-muted"}`}>{row.rank}</td>
                      <td className="py-2.5">
                        <Link href={`/club/${league}/${row.abbr}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
                          <Crest src={row.logo} code={row.abbr} size={18} className="w-5" />
                          <span className={`truncate ${selected ? "font-semibold text-zinc-100" : ""}`}>{row.name}</span>
                        </Link>
                      </td>
                      <td className="py-2.5 text-right text-muted tabnums">{row.gp}</td>
                      <td className="py-2.5 text-right text-muted tabnums">{row.gd > 0 ? `+${row.gd}` : row.gd}</td>
                      <td className="py-2.5 pr-3 text-right font-semibold tabnums">{row.pts}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Link href={`/league/${league}`} className="block border-t border-line/60 px-4 py-3 text-[10px] uppercase tracking-[0.14em] text-accent hover:bg-white/[0.02]">
              Full {data.competitionShort} table →
            </Link>
          </div>

          {data.projection && (
            <div className="terminal-panel mt-4 p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] text-muted">Season outlook</div>
                  <div className="mt-1 text-[10px] text-zinc-600">{data.projection.label}</div>
                </div>
                <div className="text-right">
                  <div className="display text-2xl font-bold text-zinc-100 tabnums">{data.projection.projectedPoints}</div>
                  <div className="text-[9px] uppercase tracking-[0.12em] text-muted">Projected pts</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ProjectionStat label={data.projection.titleLabel} value={data.projection.title} />
                <ProjectionStat label={data.projection.topLabel} value={data.projection.qualify} />
                {data.projection.uecl > 0 && <ProjectionStat label="Conference" value={data.projection.uecl} />}
                {data.projection.relegation > 0 && <ProjectionStat label="Relegation" value={data.projection.relegation} danger />}
              </div>
            </div>
          )}
        </div>
      </section>

      <section id="squad" className="mt-10 scroll-mt-5">
        <SectionHeading index="05" title="Squad leaders" detail={`${data.rosterCount} players tracked`} />
        {data.leaders.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.leaders.map((player) => (
              <LeaderCard key={player.id} player={player} league={league} club={data.team.name} clubHref={`/club/${league}/${data.team.abbr}#squad`} />
            ))}
          </div>
        ) : (
          <div className="terminal-empty px-5 py-7 text-xs text-muted">Squad statistics are not available yet.</div>
        )}
      </section>

      <section className="mt-8">
        <SectionHeading index="06" title="Availability" detail={data.availability.length ? `${data.availability.length} flagged` : "Clear"} />
        {data.availability.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {data.availability.map((item) => (
              <div key={`${item.playerId}:${item.status}`} className="terminal-panel flex items-center gap-3 p-4">
                <PlayerFace src={item.headshot} name={item.player} size={42} relaxed />
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-zinc-200">{item.player}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-warn">{String(item.status)}</div>
                  {item.detail && <p className="mt-1 text-[10px] leading-relaxed text-muted">{String(item.detail)}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="terminal-panel flex items-center gap-3 px-5 py-5 text-[11px] text-muted">
            <span className="h-2 w-2 rounded-full bg-accent" />
            No current availability flags in the team feed.
          </div>
        )}
      </section>

      <Footer />
    </main>
  );
}

function HeroStat({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div className="bg-black/40 px-4 py-3.5">
      <div className="text-[9px] uppercase tracking-[0.15em] text-muted">{label}</div>
      <div className="display mt-1 text-2xl font-bold text-zinc-100 tabnums">{value}</div>
      {detail && <div className="mt-1 truncate text-[9px] uppercase tracking-[0.1em] text-zinc-600">{detail}</div>}
    </div>
  );
}

function SectionHeading({ index, title, detail }: { index: string; title: string; detail?: string }) {
  return (
    <div className="section-heading" data-index={index}>
      <h2>{title}</h2>
      {detail && <span className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">{detail}</span>}
    </div>
  );
}

function NextFixture({ forecast, league, clubAbbr }: { forecast: ClubFixtureForecast; league: string; clubAbbr: string }) {
  const { match, outcome, market, opponent, teamSide } = forecast;
  const venue = teamSide === "home" ? "Home" : "Away";
  return (
    <Link href={`/m/${league}/${match.id}`} className="terminal-panel terminal-panel--interactive block p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="site-kicker">Next fixture · {venue}</div>
          <div className="mt-2 flex items-center gap-3">
            <Crest src={opponent.logo} code={opponent.abbr} size={42} className="w-12" />
            <div>
              <div className="display text-2xl font-bold text-zinc-100 sm:text-3xl">{opponent.name}</div>
              <time dateTime={match.dateISO} className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-muted">{formatFixture(match.dateISO)}</time>
            </div>
          </div>
        </div>
        <span className="rounded-full border border-line bg-black/25 px-2.5 py-1 text-[9px] uppercase tracking-[0.14em] text-muted">{match.detail || "Scheduled"}</span>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <ProbabilityBar label="Model" home={outcome.pHome} draw={outcome.pDraw} away={outcome.pAway} homeName={match.home.name} awayName={match.away.name} />
        {market ? (
          <ProbabilityBar label={`Market · ${market.books} books`} home={market.pHome} draw={market.pDraw} away={market.pAway} homeName={match.home.name} awayName={match.away.name} market />
        ) : (
          <div className="rounded-[7px] border border-line/70 bg-black/20 px-3 py-3 text-[10px] leading-relaxed text-muted">Market line not posted. The rating model is the current read.</div>
        )}
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line/60 pt-4">
        <div className="text-[10px] uppercase tracking-[0.13em] text-muted">
          {clubAbbr} win consensus <strong className="ml-1 text-sm text-zinc-100 tabnums">{formatPct(forecast.consensusProbability)}</strong>
        </div>
        <span className="text-[10px] uppercase tracking-[0.13em] text-accent">Open match center →</span>
      </div>
    </Link>
  );
}

function ForecastCard({ forecast, league, clubName }: { forecast: ClubFixtureForecast; league: string; clubName: string }) {
  const isClubLean = forecast.consensusProbability >= Math.max(forecast.outcome.pDraw, 0.42);
  return (
    <Link href={`/m/${league}/${forecast.match.id}`} className="terminal-panel terminal-panel--interactive block p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Crest src={forecast.opponent.logo} code={forecast.opponent.abbr} size={28} className="w-8" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-zinc-200">{forecast.opponent.name}</div>
            <time dateTime={forecast.match.dateISO} className="mt-0.5 block text-[9px] uppercase tracking-[0.11em] text-muted">{formatFixtureShort(forecast.match.dateISO)} · {forecast.teamSide === "home" ? "H" : "A"}</time>
          </div>
        </div>
        <span className="display text-xl font-bold text-zinc-100 tabnums">{formatPct(forecast.consensusProbability)}</span>
      </div>
      <div className="mt-4 border-t border-line/60 pt-3 text-[10px] leading-relaxed text-muted">
        {isClubLean ? `${clubName} carries the stronger side of the read.` : "The matchup remains low-conviction."}
        {forecast.market && <span className="text-zinc-600"> Model + {forecast.market.books}-book market blend.</span>}
      </div>
    </Link>
  );
}

function ProbabilityBar({ label, home, draw, away, homeName, awayName, market = false }: { label: string; home: number; draw: number; away: number; homeName: string; awayName: string; market?: boolean }) {
  return (
    <div>
      <div className="mb-2 text-[9px] uppercase tracking-[0.15em] text-muted">{label}</div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-zinc-800" role="img" aria-label={`${homeName} ${formatPct(home)}, draw ${formatPct(draw)}, ${awayName} ${formatPct(away)}`}>
        <div className={market ? "bg-amber-400/80" : "bg-accent/80"} style={{ width: formatPct(home) }} />
        <div className="bg-zinc-600" style={{ width: formatPct(draw) }} />
        <div className={market ? "bg-orange-300/70" : "bg-sky-400/70"} style={{ width: formatPct(away) }} />
      </div>
      <div className="mt-1.5 grid grid-cols-3 text-[9px] text-muted tabnums">
        <span className="truncate">H {formatPct(home)}</span>
        <span className="text-center">D {formatPct(draw)}</span>
        <span className="truncate text-right">A {formatPct(away)}</span>
      </div>
    </div>
  );
}

function RecentRow({ match, league, clubAbbr }: { match: LeagueMatch; league: string; clubAbbr: string }) {
  const clubIsHome = match.home.abbr.toUpperCase() === clubAbbr.toUpperCase();
  const club = clubIsHome ? match.home : match.away;
  const opponent = clubIsHome ? match.away : match.home;
  const mine = Number(club.score);
  const theirs = Number(opponent.score);
  const result = mine === theirs ? "D" : mine > theirs ? "W" : "L";
  return (
    <Link href={`/m/${league}/${match.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
      <ResultPill result={result} />
      <Crest src={opponent.logo} code={opponent.abbr} size={20} className="w-6" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs text-zinc-200">{opponent.name}</div>
        <time dateTime={match.dateISO} className="text-[9px] uppercase tracking-[0.1em] text-zinc-600">{formatFixtureShort(match.dateISO)} · {clubIsHome ? "H" : "A"}</time>
      </div>
      <div className="display text-base font-bold text-zinc-100 tabnums">{club.score ?? "—"}<span className="px-1 text-zinc-600">–</span>{opponent.score ?? "—"}</div>
    </Link>
  );
}

function UpcomingRow({ match, league, clubAbbr }: { match: LeagueMatch; league: string; clubAbbr: string }) {
  const clubIsHome = match.home.abbr.toUpperCase() === clubAbbr.toUpperCase();
  const opponent = clubIsHome ? match.away : match.home;
  return (
    <Link href={`/m/${league}/${match.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02]">
      <div className="w-10 text-center text-[9px] uppercase tracking-[0.1em] text-zinc-600">{clubIsHome ? "Home" : "Away"}</div>
      <Crest src={opponent.logo} code={opponent.abbr} size={20} className="w-6" />
      <div className="min-w-0 flex-1 truncate text-xs text-zinc-200">{opponent.name}</div>
      <time dateTime={match.dateISO} className="text-right text-[9px] uppercase tracking-[0.1em] text-muted tabnums">{formatFixtureShort(match.dateISO)}</time>
    </Link>
  );
}

function UpcomingCard({ match, league, clubAbbr, prominent = false }: { match: LeagueMatch; league: string; clubAbbr: string; prominent?: boolean }) {
  const clubIsHome = match.home.abbr.toUpperCase() === clubAbbr.toUpperCase();
  const opponent = clubIsHome ? match.away : match.home;
  return (
    <Link href={`/m/${league}/${match.id}`} className={`terminal-panel terminal-panel--interactive block ${prominent ? "p-6" : "p-4"}`}>
      <div className="site-kicker">Next fixture · {clubIsHome ? "Home" : "Away"}</div>
      <div className="mt-4 flex items-center gap-3">
        <Crest src={opponent.logo} code={opponent.abbr} size={42} className="w-12" />
        <div>
          <div className="display text-2xl font-bold text-zinc-100">{opponent.name}</div>
          <time dateTime={match.dateISO} className="mt-1 block text-[10px] uppercase tracking-[0.12em] text-muted">{formatFixture(match.dateISO)}</time>
        </div>
      </div>
    </Link>
  );
}

function FormStrip({ form }: { form: Array<"W" | "D" | "L"> }) {
  return <div className="flex gap-1">{form.map((result, index) => <ResultPill key={`${result}:${index}`} result={result} compact />)}</div>;
}

function ResultPill({ result, compact = false }: { result: "W" | "D" | "L"; compact?: boolean }) {
  const classes = result === "W" ? "border-accent/30 bg-accent/10 text-accent" : result === "L" ? "border-warn/30 bg-warn/[0.08] text-warn" : "border-zinc-600 bg-zinc-800/70 text-zinc-400";
  return <span className={`inline-flex shrink-0 items-center justify-center rounded border text-[9px] font-semibold ${classes} ${compact ? "h-5 w-5" : "h-6 w-6"}`}>{result}</span>;
}

function ProjectionStat({ label, value, danger = false }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="rounded-[7px] border border-line/70 bg-black/20 px-3 py-2.5">
      <div className={`display text-xl font-bold tabnums ${danger ? "text-warn" : "text-zinc-100"}`}>{formatPct(value)}</div>
      <div className="mt-1 text-[9px] uppercase tracking-[0.11em] text-muted">{label}</div>
    </div>
  );
}

function LeaderCard({ player, league, club, clubHref }: { player: ClubPlayer; league: string; club: string; clubHref: string }) {
  const playerItem = {
    key: `player:${league}:${player.id}`,
    kind: "player" as const,
    title: player.name,
    context: `${club} · ${player.position}`,
    href: clubHref,
    image: player.headshot,
  };
  return (
    <article className="terminal-panel p-4">
      <div className="flex items-start gap-3">
        <PlayerFace src={player.headshot} name={player.name} jersey={player.jersey} size={50} relaxed />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-100">{player.shortName}</h3>
              <div className="mt-1 text-[9px] uppercase tracking-[0.12em] text-muted">{player.position}{player.jersey ? ` · #${player.jersey}` : ""}</div>
            </div>
            <WatchlistButton item={playerItem} iconOnly />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-line/60 pt-3">
            <PlayerStat label="Apps" value={player.appearances} />
            <PlayerStat label="Goals" value={player.goals} />
            <PlayerStat label="Assists" value={player.assists} />
          </div>
        </div>
      </div>
    </article>
  );
}

function PlayerStat({ label, value }: { label: string; value: number }) {
  return <div><div className="display text-lg font-bold text-zinc-200 tabnums">{value}</div><div className="text-[8px] uppercase tracking-[0.11em] text-zinc-600">{label}</div></div>;
}

function formatPct(value: number) {
  if (value > 0 && value < 0.005) return "<1%";
  return `${Math.round(value * 100)}%`;
}

function formatFixture(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function formatFixtureShort(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}
