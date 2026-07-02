"use client";

import { useEffect, useState } from "react";
import type { MatchView } from "@/lib/compute";
import type { SimRow } from "@/lib/bracket";
import type { RatingSource } from "@/lib/data";
import { trackRecord, tournamentFav } from "@/lib/compute";
import MatchCard from "./MatchCard";
import TitleRace from "./TitleRace";

type Board = { matches: MatchView[]; sim: SimRow[] };
type Payload = {
  live: boolean;
  blend: Board;
  model: Board;
  market: Board;
  updatedAt: string;
};

const REFRESH_MS = 30_000;

export default function LiveBoard({ initial }: { initial: Payload }) {
  const [data, setData] = useState<Payload>(initial);
  const [source, setSource] = useState<RatingSource>("blend");
  const [mounted, setMounted] = useState(false);
  const [ago, setAgo] = useState(0);

  useEffect(() => {
    setMounted(true);
    let alive = true;
    async function pull() {
      try {
        const res = await fetch("/api/scores", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as Payload;
        if (alive) setData(json);
      } catch {
        /* keep last good data */
      }
    }
    const id = setInterval(pull, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const id = setInterval(() => {
      setAgo(Math.round((Date.now() - new Date(data.updatedAt).getTime()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [mounted, data.updatedAt]);

  const board = data[source];
  const matches = board.matches;
  const live = matches
    .filter((m) => m.status === "live")
    .sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  const upcoming = matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => a.kickoffISO.localeCompare(b.kickoffISO));
  const finals = matches
    .filter((m) => m.status === "final")
    .sort((a, b) => b.kickoffISO.localeCompare(a.kickoffISO));

  const record = trackRecord(matches);
  const fav = tournamentFav(matches, source);
  const hitRate =
    record.played > 0 ? Math.round((record.hits / record.played) * 100) : null;

  // current stage = earliest round with an unfinished match
  const STAGES: [string, string, string][] = [
    ["r32-", "Round of 32", "32 → 16"],
    ["r16-", "Round of 16", "16 → 8"],
    ["qf-", "Quarter-finals", "8 → 4"],
    ["sf-", "Semi-finals", "4 → 2"],
    ["final", "Final", "2 → 1"],
  ];
  const stage =
    STAGES.find(([p]) =>
      matches.some((m) => m.id.startsWith(p) && m.status !== "final")
    ) ?? STAGES[STAGES.length - 1];

  return (
    <>
      {/* source toggle + live status */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-lg border border-line bg-panel2/60 p-0.5 text-[11px] uppercase tracking-wider">
          <Toggle active={source === "blend"} onClick={() => setSource("blend")}>
            Consensus
          </Toggle>
          <Toggle active={source === "model"} onClick={() => setSource("model")}>
            Our model
          </Toggle>
          <Toggle active={source === "market"} onClick={() => setSource("market")}>
            Market
          </Toggle>
        </div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted">
          <span
            className={`inline-block w-1.5 h-1.5 rounded-full ${
              data.live ? "bg-accent animate-pulse" : "bg-danger"
            }`}
          />
          {data.live ? "Live · ESPN" : "Feed offline"}
          <span className="hidden sm:inline text-zinc-600">
            {mounted ? `· ${ago}s ago` : ""}
          </span>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] text-muted">
        {source === "blend"
          ? "Consensus — our data Elo blended 50/50 with market-implied strength."
          : source === "model"
          ? "Our model — Elo ratings computed from 49,000+ real international results."
          : "Market view — strength implied by pre-tournament betting odds."}
      </p>

      {/* KPI strip */}
      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-px bg-line rounded-lg overflow-hidden border border-line card-shadow">
        <Kpi label="Stage" value={stage[1]} sub={stage[2]} />
        <Kpi
          label="Top seed alive"
          value={fav ? `${fav.code}` : "—"}
          sub={
            source === "market"
              ? fav?.titleOdds ?? ""
              : source === "blend" && fav
              ? `Elo ${Math.round((fav.rating + (fav.marketRating ?? fav.rating)) / 2)}`
              : `Elo ${fav?.rating ?? ""}`
          }
        />
        <Kpi
          label={`${
            source === "blend" ? "Consensus" : source === "model" ? "Model" : "Market"
          } record`}
          value={hitRate === null ? "—" : `${hitRate}%`}
          sub={`${record.hits}/${record.played} KO picks`}
        />
        <Kpi
          label="Live now"
          value={`${live.length}`}
          sub={`${upcoming.length} upcoming`}
        />
      </div>

      {live.length > 0 && (
        <Section title="● LIVE NOW" count={live.length} accent>
          <Grid>
            {live.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </Grid>
        </Section>
      )}

      {board.sim?.length > 0 && (
        <Section title="TITLE RACE — 10K SIMULATIONS" count={board.sim.length}>
          <TitleRace rows={board.sim} />
        </Section>
      )}

      <Section title="UPCOMING" count={upcoming.length}>
        <Grid>
          {upcoming.map((m) => (
            <MatchCard key={m.id} m={m} />
          ))}
        </Grid>
      </Section>

      {finals.length > 0 && (
        <Section title="DECIDED" count={finals.length}>
          <Grid>
            {finals.map((m) => (
              <MatchCard key={m.id} m={m} />
            ))}
          </Grid>
        </Section>
      )}
    </>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-md transition-colors ${
        active ? "bg-accent/15 text-accent" : "text-muted hover:text-text"
      }`}
    >
      {children}
    </button>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-panel px-4 py-3">
      <div className="text-[10px] uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabnums">{value}</div>
      <div className="text-[10px] text-muted tabnums">{sub}</div>
    </div>
  );
}

function Section({
  title,
  count,
  accent,
  children,
}: {
  title: string;
  count: number;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 fade-up">
      <div className="mb-3 flex items-center gap-3">
        <h2
          className={`text-[11px] uppercase tracking-[0.2em] ${
            accent ? "text-accent" : "text-zinc-400"
          }`}
        >
          {title}
        </h2>
        <span className="text-[11px] text-muted">[{count}]</span>
        <span className="flex-1 h-px bg-line" />
      </div>
      {children}
    </section>
  );
}
