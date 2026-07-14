import Link from "next/link";
import { getUfcProjections, UFC_EVENT, type FightProjection } from "@/lib/ufc";
import Footer from "@/components/Footer";
import Nav from "@/components/Nav";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function signedPct(n: number) {
  const v = Math.round(n * 100);
  if (v > 0) return `+${v}`;
  return `${v}`;
}

function american(n: number) {
  return n > 0 ? `+${n}` : `${n}`;
}

function confidenceLabel(n: number) {
  if (n >= 0.22) return { label: "STRONG", color: "text-accent" };
  if (n >= 0.12) return { label: "LEAN", color: "text-warn" };
  return { label: "THIN", color: "text-danger" };
}

export default function UfcConsensus() {
  const projections = getUfcProjections();
  const top = projections[0];

  return (
    <main className="site-shell">
      <div className="site-topbar">
        <Link
          href="/"
          className="site-wordmark"
        >
          <span className="text-accent">▸</span> CONSENSUS
        </Link>
        <Nav />
      </div>

      <header className="site-header">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div>
            <div className="site-kicker">02 / Combat sports module</div>
            <h1 className="site-title">
              UFC Consensus
            </h1>
            <p className="site-subtitle">
              A fight-prediction surface that blends a transparent fighter model,
              no-vig market odds, and analyst pick share into one consensus read.
              This first version uses static seed data so the interface and model
              shape can be built before live feeds are connected.
            </p>
          </div>

          <div className="terminal-panel min-w-64 p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted">
              Current strongest read
            </div>
            <div className="mt-2 text-lg font-semibold">
              {top.fight[top.pick].name}
            </div>
            <div className="mt-1 text-xs text-muted">
              {pct(
                top.pick === "red" ? top.consensusRed : top.consensusBlue
              )}{" "}
              consensus · {top.fight.weightClass}
            </div>
          </div>
        </div>
      </header>

      <section className="terminal-kpi-grid mt-8 grid gap-px sm:grid-cols-3">
        <Metric label="Event" value={UFC_EVENT.name} sub={UFC_EVENT.date} />
        <Metric label="Venue" value={UFC_EVENT.venue} sub="placeholder source" />
        <Metric
          label="Fights"
          value={`${projections.length}`}
          sub="ranked by confidence"
        />
      </section>

      <section className="terminal-panel mt-8 p-4 text-xs leading-relaxed text-muted">
        <span className="text-zinc-400">Data note:</span> {UFC_EVENT.note} The
        next production step is replacing these inputs with scheduled bouts,
        closing odds snapshots, and tracked analyst/public picks.
      </section>

      <section className="mt-10">
        <div className="section-heading" data-index="03">
          <h2>
            Fight board
          </h2>
          <span className="text-[11px] text-muted">[{projections.length}]</span>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {projections.map((p) => (
            <FightCard key={p.fight.id} projection={p} />
          ))}
        </div>
      </section>

      <section className="terminal-panel mt-12 p-5 text-xs leading-relaxed text-muted">
        <h2 className="text-[11px] uppercase tracking-wider text-zinc-400 mb-2">
          Methodology
        </h2>
        <p>
          The starter model scores each fighter across striking, grappling,
          cardio, and durability, with small adjustments for reach and five-round
          cardio. Consensus probability is currently 55% model, 30% no-vig
          market, and 15% analyst pick share. Edge compares model probability
          against no-vig market probability.
        </p>
        <p className="mt-3 text-[11px] text-zinc-600">
          For entertainment and product development only. Do not use this as
          betting advice.
        </p>
      </section>

      <Footer />
    </main>
  );
}

function FightCard({ projection: p }: { projection: FightProjection }) {
  const f = p.fight;
  const conf = confidenceLabel(p.confidence);

  return (
    <article className="terminal-panel terminal-panel--interactive">
      <div className="terminal-panel-header flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted">
        <span>{f.weightClass}</span>
        <span>{f.rounds} rounds</span>
      </div>

      <div className="p-4">
        <FighterRow
          side="red"
          active={p.pick === "red"}
          name={f.red.name}
          nickname={f.red.nickname}
          record={f.red.record}
          country={f.red.country}
          odds={f.market.redAmerican}
          consensus={p.consensusRed}
          model={p.modelRed}
          market={p.marketRed}
          edge={p.edgeRed}
        />

        <div className="my-3 flex h-2.5 overflow-hidden rounded-full bg-zinc-800">
          <div className="bg-accent/80" style={{ width: pct(p.consensusRed) }} />
          <div className="bg-sky-500/70" style={{ width: pct(p.consensusBlue) }} />
        </div>

        <FighterRow
          side="blue"
          active={p.pick === "blue"}
          name={f.blue.name}
          nickname={f.blue.nickname}
          record={f.blue.record}
          country={f.blue.country}
          odds={f.market.blueAmerican}
          consensus={p.consensusBlue}
          model={p.modelBlue}
          market={p.marketBlue}
          edge={p.edgeBlue}
        />
      </div>

      <div className="grid grid-cols-3 divide-x divide-line border-t border-line text-center">
        <Metric
          label="Pick"
          value={f[p.pick].name.split(" ").slice(-1)[0]}
          sub={p.methodRead}
          valueClass="text-accent"
        />
        <Metric
          label="Confidence"
          value={conf.label}
          sub={pct(p.confidence)}
          valueClass={conf.color}
        />
        <Metric
          label="Best edge"
          value={`${signedPct(Math.max(p.edgeRed, p.edgeBlue))} pts`}
          sub="model vs market"
          valueClass={
            Math.max(p.edgeRed, p.edgeBlue) >= 0.05
              ? "text-warn"
              : "text-zinc-400"
          }
        />
      </div>
    </article>
  );
}

function FighterRow({
  side,
  active,
  name,
  nickname,
  record,
  country,
  odds,
  consensus,
  model,
  market,
  edge,
}: {
  side: "red" | "blue";
  active: boolean;
  name: string;
  nickname?: string;
  record: string;
  country: string;
  odds: number;
  consensus: number;
  model: number;
  market: number;
  edge: number;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`mt-1 h-10 w-1.5 rounded-full ${
          side === "red" ? "bg-accent/80" : "bg-sky-500/80"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold leading-tight">{name}</h3>
              {active && (
                <span className="rounded border border-accent/40 px-1.5 py-px text-[9px] uppercase tracking-wider text-accent">
                  pick
                </span>
              )}
            </div>
            <div className="mt-1 text-[11px] text-muted">
              {nickname ? `“${nickname}” · ` : ""}
              {record} · {country}
            </div>
          </div>
          <div className="text-right tabnums">
            <div className="text-sm font-semibold">{pct(consensus)}</div>
            <div className="text-[10px] text-muted">{american(odds)}</div>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted tabnums">
          <span>Model {pct(model)}</span>
          <span>Market {pct(market)}</span>
          <span className={edge >= 0.04 ? "text-warn" : "text-muted"}>
            Edge {signedPct(edge)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  valueClass = "text-zinc-100",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="terminal-kpi p-4">
      <div className="text-[10px] uppercase tracking-wider text-muted">
        {label}
      </div>
      <div className={`mt-1 text-sm font-semibold leading-tight ${valueClass}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] text-muted leading-snug">{sub}</div>
    </div>
  );
}
