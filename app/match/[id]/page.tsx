import { notFound } from "next/navigation";
import Link from "next/link";
import { getLiveMatches } from "@/lib/live";
import { fetchMatchDetail, fetchPredictedSquads, type Goal } from "@/lib/match";
import { TEAMS } from "@/lib/data";
import Crest from "@/components/Crest";
import Lineups from "@/components/Lineups";
import { BallIcon } from "@/components/PlayerMarkers";
import TeamStats from "@/components/TeamStats";
import RecentMeetings from "@/components/RecentMeetings";
import Nav from "@/components/Nav";

export const dynamic = "force-dynamic";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

export default async function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matches } = await getLiveMatches();
  const m = matches.find((x) => x.id === id);
  if (!m) notFound();
  const adv = m.liveAdvance ?? m.advance;

  const detail = await fetchMatchDetail(id, m.espnId);

  // Before official lineups drop (~1h pre-kickoff), project each XI from the
  // team's last match — our prediction, badged as such.
  let squads = detail?.squads ?? [];
  let haveLineups = !!detail?.hasLineups;
  if (
    detail &&
    !haveLineups &&
    detail.status === "pre" &&
    detail.home.id &&
    detail.away.id
  ) {
    const predicted = await fetchPredictedSquads(
      "fifa.world",
      detail.home.id,
      detail.away.id
    );
    if (predicted) {
      squads = predicted;
      haveLineups = true;
    }
  }

  const live = detail?.status === "in";
  const decided = detail?.status === "post" || m.status === "final";
  const showScore = live || decided;
  const homeScore = detail?.home.score ?? m.score?.home;
  const awayScore = detail?.away.score ?? m.score?.away;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 sm:px-6 pb-20">
      <header className="pt-6 pb-4 flex items-center justify-between">
        <Link
          href="/wc"
          className="text-[11px] uppercase tracking-wider text-muted hover:text-text"
        >
          ← Terminal
        </Link>
        <Nav />
      </header>

      {/* scoreline header */}
      <div className="rounded-xl border border-line bg-panel/70 p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <TeamHead teamKey={m.homeKey} name={m.home.name} align="right" />
          <div className="text-center">
            {showScore ? (
              <div className="text-3xl font-bold tabnums">
                {homeScore}<span className="text-muted px-1">–</span>{awayScore}
              </div>
            ) : (
              <div className="text-sm text-muted">{m.date}</div>
            )}
            <div
              className={`mt-1 text-[11px] uppercase tracking-wider ${
                live ? "text-accent" : "text-muted"
              }`}
            >
              {live && "● "}
              {detail?.detail ?? (m.status === "final" ? "Full time" : "Upcoming")}
            </div>
          </div>
          <TeamHead teamKey={m.awayKey} name={m.away.name} align="left" />
        </div>

        {detail?.goals && detail.goals.length > 0 && (
          <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-start gap-4 text-[11px]">
            <div className="text-right space-y-0.5">
              {detail.goals
                .filter((g) => g.side === "home")
                .map((g, i) => (
                  <GoalLine key={i} g={g} />
                ))}
            </div>
            <div className="pt-0.5 mx-auto h-3.5 w-3.5">
              <BallIcon />
            </div>
            <div className="text-left space-y-0.5">
              {detail.goals
                .filter((g) => g.side === "away")
                .map((g, i) => (
                  <GoalLine key={i} g={g} />
                ))}
            </div>
          </div>
        )}

        <div className="mt-3 text-center text-[11px] text-muted">
          {m.venue}
          {detail?.venue ? ` · ${detail.venue}` : ""}
        </div>
      </div>

      {/* win probability — kickoff vs now */}
      <section className="mt-5 rounded-xl border border-line bg-panel/50 p-4">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-3">
          Win probability
        </h2>

        {m.liveProb ? (
          <div className="space-y-3">
            <ProbBar
              label={`Now · ${m.minute}'`}
              live
              p={m.liveProb}
              pre={m.outcome}
              home={m.home.name}
              away={m.away.name}
            />
            <ProbBar
              label="At kickoff"
              p={m.outcome}
              home={m.home.name}
              away={m.away.name}
            />
          </div>
        ) : (
          <ProbBar
            label="Pre-match model"
            p={m.outcome}
            home={m.home.name}
            away={m.away.name}
          />
        )}

        {/* to advance — knockout two-way market (no draw) */}
        <div className="mt-4">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">
            {m.liveAdvance ? "● " : ""}To advance · incl. extra time &amp; penalties
          </div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-accent/80" style={{ width: pct(adv.home) }} />
            <div className="bg-sky-400/70" style={{ width: pct(adv.away) }} />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-muted tabnums">
            <span>
              {m.home.name} {pct(adv.home)}
            </span>
            <span>
              {pct(adv.away)} {m.away.name}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
          <Stat label="Expected goals" value={`${m.outcome.lambdaHome.toFixed(1)} – ${m.outcome.lambdaAway.toFixed(1)}`} />
          <Stat label="Likely score" value={`${m.outcome.topScore.home} – ${m.outcome.topScore.away}`} />
          <Stat label="Model pick" value={TEAMS[m.modelPickKey].code} />
        </div>
      </section>

      {/* team match stats */}
      {detail?.teamStats && (
        <TeamStats
          home={detail.teamStats.home}
          away={detail.teamStats.away}
          homeKey={m.homeKey}
          awayKey={m.awayKey}
        />
      )}

      {/* lineups */}
      <section className="mt-5">
        <h2 className="text-[10px] uppercase tracking-[0.2em] text-zinc-400 mb-3">
          Lineups
        </h2>
        {haveLineups ? (
          <Lineups squads={squads} status={detail?.status} />
        ) : (
          <div className="rounded-xl border border-line bg-panel/50 p-6 text-center text-sm text-muted">
            Lineups not announced yet — they typically post about an hour before
            kickoff. Check back closer to the match.
          </div>
        )}
      </section>

      {/* head to head */}
      {detail && <RecentMeetings games={detail.h2h} />}
    </div>
  );
}

function TeamHead({
  teamKey,
  name,
  align,
}: {
  teamKey: string;
  name: string;
  align: "left" | "right";
}) {
  return (
    <div
      className={`flex items-center gap-3 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <Crest teamKey={teamKey} code={TEAMS[teamKey].code} size={44} />
      <div>
        <div className="font-semibold leading-tight">{name}</div>
        <div className="text-[10px] text-muted">{TEAMS[teamKey].titleOdds ?? ""}</div>
      </div>
    </div>
  );
}

function ProbBar({
  label,
  p,
  pre,
  live,
  home,
  away,
}: {
  label: string;
  p: { pHome: number; pDraw: number; pAway: number };
  pre?: { pHome: number; pDraw: number; pAway: number };
  live?: boolean;
  home: string;
  away: string;
}) {
  const dHome = pre ? p.pHome - pre.pHome : 0;
  const dAway = pre ? p.pAway - pre.pAway : 0;
  const chip = (d: number) => {
    if (!pre || Math.abs(d) < 0.005) return null;
    const up = d > 0;
    return (
      <span className={up ? "text-accent" : "text-danger"}>
        {" "}
        {up ? "▲" : "▼"}
        {Math.abs(Math.round(d * 100))}
      </span>
    );
  };
  return (
    <div>
      <div
        className={`mb-1 text-[10px] uppercase tracking-wider ${
          live ? "text-accent" : "text-muted"
        }`}
      >
        {live && "● "}
        {label}
        {pre && live && (
          <span className="float-right normal-case tracking-normal text-muted">
            ┊ = kickoff
          </span>
        )}
      </div>
      <div className="relative flex h-3 w-full overflow-hidden rounded-full bg-zinc-800">
        <div className="bg-accent/80" style={{ width: pct(p.pHome) }} />
        <div className="bg-zinc-600" style={{ width: pct(p.pDraw) }} />
        <div className="bg-sky-500/70" style={{ width: pct(p.pAway) }} />
        {pre && (
          <>
            <span
              className="absolute top-0 bottom-0 w-px bg-white/70"
              style={{ left: pct(pre.pHome) }}
            />
            <span
              className="absolute top-0 bottom-0 w-px bg-white/70"
              style={{ left: pct(pre.pHome + pre.pDraw) }}
            />
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted tabnums">
        <span>
          {home} {pct(p.pHome)}
          {chip(dHome)}
        </span>
        <span>Draw {pct(p.pDraw)}</span>
        <span>
          {pct(p.pAway)} {away}
          {chip(dAway)}
        </span>
      </div>
    </div>
  );
}

function GoalLine({ g }: { g: Goal }) {
  return (
    <div className="text-zinc-200">
      {g.scorer}{" "}
      <span className="text-muted tabnums">
        {g.minute}
        {g.tag ? ` (${g.tag})` : ""}
      </span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-panel2/60 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className="text-sm font-semibold tabnums">{value}</div>
    </div>
  );
}

