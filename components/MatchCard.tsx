import Link from "next/link";
import type { MatchView } from "@/lib/compute";
import Crest from "./Crest";

function pct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function Delta({ d, show }: { d: number; show: boolean }) {
  if (!show || Math.abs(d) < 0.005) return null;
  const up = d > 0;
  return (
    <span className={up ? "text-accent" : "text-danger"}>
      {up ? "▲" : "▼"}
      {Math.abs(Math.round(d * 100))}
    </span>
  );
}

function confidenceLabel(c: number) {
  if (c >= 0.5) return { label: "STRONG", color: "text-accent" };
  if (c >= 0.25) return { label: "LEAN", color: "text-warn" };
  return { label: "COIN-FLIP", color: "text-danger" };
}

export default function MatchCard({ m }: { m: MatchView }) {
  const o = m.outcome;
  const conf = confidenceLabel(m.confidence);
  const favHome = m.advance.home >= m.advance.away;
  const adv = m.liveAdvance ?? m.advance;
  const isLive = m.status === "live";
  const isFinal = m.status === "final";
  const showScore = isLive || isFinal;
  const pens = m.live?.pens;

  return (
    <Link
      href={`/match/${m.id}`}
      className={`terminal-panel terminal-panel--interactive block ${
        isLive ? "border-accent/60 shadow-[0_0_0_1px_rgba(52,211,153,0.18)]" : ""
      }`}
    >
      {/* header */}
      <div className="terminal-panel-header flex items-center justify-between px-4 py-2 text-[9px] uppercase tracking-[0.14em] text-muted">
        <span className="tabnums">
          {m.date} · {m.venue}
        </span>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-accent font-semibold">
            <span className="signal-dot" />
            LIVE {m.live?.clock ?? m.live?.detail}
          </span>
        ) : isFinal ? (
          <span className="text-zinc-400">{m.live?.detail ?? "FT"}</span>
        ) : (
          <span className="text-muted">UPCOMING</span>
        )}
      </div>

      {/* teams */}
      <div className="px-4 pt-3 pb-1 space-y-2">
        <TeamRow
          teamKey={m.homeKey}
          code={m.home.code}
          name={m.home.name}
          odds={m.home.titleOdds}
          adv={m.advance.home}
          ml={m.homeML}
          fav={favHome}
          score={m.score?.home}
          showScore={showScore}
          isWinner={m.winnerKey === m.homeKey}
          decided={isFinal}
        />
        <TeamRow
          teamKey={m.awayKey}
          code={m.away.code}
          name={m.away.name}
          odds={m.away.titleOdds}
          adv={m.advance.away}
          ml={m.awayML}
          fav={!favHome}
          score={m.score?.away}
          showScore={showScore}
          isWinner={m.winnerKey === m.awayKey}
          decided={isFinal}
        />
      </div>

      {pens && (
        <div className="px-4 pb-1 text-[10px] text-muted tabnums">
          penalties {pens.home}–{pens.away}
        </div>
      )}

      {/* win/draw/win bar — in-play when live, else pre-match model */}
      {(() => {
        const pre = { pHome: o.pHome, pDraw: o.pDraw, pAway: o.pAway };
        const probs = m.liveProb ?? pre;
        const onLive = !!m.liveProb;
        const dHome = probs.pHome - pre.pHome;
        const dAway = probs.pAway - pre.pAway;
        return (
          <div className="px-4 pt-2">
            <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wider">
              <span className={onLive ? "text-accent" : "text-muted"}>
                {onLive ? `In-play odds · ${m.minute}'` : "Pre-match model"}
              </span>
              {onLive && (
                <span className="text-muted normal-case tracking-normal">
                  ┊ = kickoff
                </span>
              )}
            </div>
            <div className="relative flex h-2.5 w-full overflow-hidden rounded-full bg-zinc-800">
              <div className="bg-accent/80" style={{ width: pct(probs.pHome) }} />
              <div className="bg-zinc-600" style={{ width: pct(probs.pDraw) }} />
              <div className="bg-sky-500/70" style={{ width: pct(probs.pAway) }} />
              {onLive && (
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
            <div className="mt-1 flex justify-between text-[10px] text-muted tabnums">
              <span className="flex items-center gap-1">
                W {pct(probs.pHome)} <Delta d={dHome} show={onLive} />
              </span>
              <span>D {pct(probs.pDraw)}</span>
              <span className="flex items-center gap-1">
                <Delta d={dAway} show={onLive} /> {pct(probs.pAway)} W
              </span>
            </div>
          </div>
        );
      })()}

      {/* to-advance market (knockout: no draw, incl. ET/pens) */}
      {!isFinal && (
        <div className="px-4 pt-2">
          <div className="mb-0.5 text-[9px] uppercase tracking-wider text-muted">
            To advance · inc. ET / pens
          </div>
          <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="bg-accent/70" style={{ width: pct(adv.home) }} />
            <div className="bg-sky-500/60" style={{ width: pct(adv.away) }} />
          </div>
          <div className="mt-0.5 flex justify-between text-[10px] tabnums">
            <span className={adv.home >= adv.away ? "text-accent" : "text-muted"}>
              {m.home.code} {pct(adv.home)}
            </span>
            <span className={adv.away > adv.home ? "text-sky-400" : "text-muted"}>
              {pct(adv.away)} {m.away.code}
            </span>
          </div>
        </div>
      )}

      {/* live sportsbook comparison — flags model-vs-market discrepancies */}
      {!isFinal &&
        m.market &&
        (() => {
          const edge = m.advance.home - m.market.advHome;
          const side = edge > 0 ? m.home.code : m.away.code;
          const mag = Math.abs(edge);
          return (
            <div className="px-4 pt-2 flex items-center justify-between text-[10px] tabnums">
              <span className="uppercase tracking-wider text-muted">
                Books ({m.market.books})
              </span>
              <span className="text-zinc-400">
                {m.home.code} {pct(m.market.advHome)}
                {m.market.delta !== undefined &&
                  Math.abs(m.market.delta) >= 0.04 && (
                    <span
                      className={
                        m.market.delta > 0 ? "text-accent" : "text-danger"
                      }
                    >
                      {" "}
                      {m.market.delta > 0 ? "▲" : "▼"}
                      {Math.abs(Math.round(m.market.delta * 100))}
                    </span>
                  )}{" "}
                · {pct(1 - m.market.advHome)} {m.away.code}
              </span>
              {mag >= 0.08 ? (
                <span className="font-semibold text-warn">
                  VALUE {side} +{Math.round(mag * 100)}
                </span>
              ) : (
                <span className="text-zinc-600">in line</span>
              )}
            </div>
          );
        })()}

      {/* footer metrics */}
      <div className="mt-2 grid grid-cols-3 divide-x divide-[var(--hairline)] border-t border-[var(--hairline)] bg-black/10 text-center">
        <Metric
          label="XPECTED"
          value={`${o.lambdaHome.toFixed(1)}–${o.lambdaAway.toFixed(1)}`}
          sub="exp. goals"
        />
        <Metric
          label="LIKELY"
          value={`${o.topScore.home}–${o.topScore.away}`}
          sub={
            o.topScores.length > 2
              ? `${pct(o.topScore.p)} · ${o.topScores[1].home}–${o.topScores[1].away} ${pct(o.topScores[1].p)} · ${o.topScores[2].home}–${o.topScores[2].away} ${pct(o.topScores[2].p)}`
              : `${pct(o.topScore.p)} scoreline`
          }
        />
        {isFinal ? (
          <Metric
            label="MODEL"
            value={m.hit ? "HIT ✓" : "MISS ✗"}
            sub="vs result"
            valueClass={m.hit ? "text-accent" : "text-danger"}
          />
        ) : (
          <Metric
            label="CONF"
            value={conf.label}
            sub={pct(m.confidence)}
            valueClass={conf.color}
          />
        )}
      </div>
    </Link>
  );
}

function TeamRow({
  teamKey,
  code,
  name,
  odds,
  adv,
  ml,
  fav,
  score,
  showScore,
  isWinner,
  decided,
}: {
  teamKey: string;
  code: string;
  name: string;
  odds?: string;
  adv: number;
  ml: string;
  fav: boolean;
  score?: number;
  showScore: boolean;
  isWinner: boolean;
  decided: boolean;
}) {
  const dim = decided && !isWinner;
  return (
    <div className="flex items-center gap-3">
      <Crest teamKey={teamKey} code={code} size={22} className="w-6" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-sm ${
              dim ? "text-zinc-500" : fav ? "text-text font-semibold" : "text-zinc-300"
            }`}
          >
            {name}
          </span>
          {decided && isWinner && (
            <span className="shrink-0 text-[9px] text-accent">▲ adv</span>
          )}
          {odds && <span className="shrink-0 text-[10px] text-muted">{odds}</span>}
        </div>
      </div>
      {showScore ? (
        <span
          className={`tabnums text-lg font-semibold w-6 text-right ${
            dim ? "text-zinc-500" : "text-text"
          }`}
        >
          {score}
        </span>
      ) : (
        <div className="text-right tabnums">
          <div className={`text-sm ${fav ? "text-accent" : "text-zinc-400"}`}>
            {pct(adv)}
          </div>
          <div className="text-[10px] text-muted">{ml}</div>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  valueClass = "text-text",
}: {
  label: string;
  value: string;
  sub: string;
  valueClass?: string;
}) {
  return (
    <div className="px-2 py-2">
      <div className="text-[9px] uppercase tracking-wider text-muted">{label}</div>
      <div className={`text-sm font-semibold tabnums ${valueClass}`}>{value}</div>
      <div className="text-[9px] text-muted">{sub}</div>
    </div>
  );
}
