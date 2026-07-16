"use client";

import { useEffect, useMemo, useState } from "react";
import { american, fairDecimal, legsFor, parlayProb, type FightPricing, type Leg } from "@/lib/ufc/betmath";
import { buildSuggestions, type Suggestion } from "@/lib/ufc/suggest";
import { getBout, inLiveWindow, subscribe } from "@/components/ufc/liveFeed";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const lastName = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");

function LegRow({
  leg,
  inSlip,
  blocked,
  onToggle,
}: {
  leg: Leg;
  inSlip: boolean;
  blocked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={blocked && !inSlip}
      aria-pressed={inSlip}
      className={`flex min-h-9 w-full items-baseline justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs ${
        inSlip
          ? "border-accent/60 bg-accent/10"
          : blocked
            ? "border-line/50 text-zinc-600 cursor-not-allowed"
            : "border-line bg-bg/35 hover:border-accent/40 hover:bg-white/[0.025]"
      }`}
    >
      <span className="truncate">{leg.label}</span>
      <span className="shrink-0 tabnums text-muted">
        {pct(leg.p)} <span className="text-zinc-300 font-semibold">{american(leg.p)}</span>
      </span>
    </button>
  );
}

const KIND_LABEL = { edge: "Edge vs books", prop: "Prop", parlay: "Parlay" } as const;
const KIND_TONE = { edge: "text-warn border-warn/40", prop: "text-blue border-blue/40", parlay: "text-accent border-accent/40" } as const;

function SuggestionCard({ s, onLoad }: { s: Suggestion; onLoad: () => void }) {
  return (
    <div className="terminal-panel terminal-panel--interactive flex flex-col">
      <div className="terminal-panel-header flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted">
        <span>Model opportunity</span>
        <span className="tabnums">fair value</span>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span
              className={`rounded border px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${KIND_TONE[s.kind]}`}
            >
              {KIND_LABEL[s.kind]}
            </span>
            <h3 className="display mt-2 text-lg font-extrabold leading-tight text-zinc-100">
              {s.title}
            </h3>
          </div>
          <div className="shrink-0 text-right tabnums">
            <div className="text-lg font-bold text-zinc-100">{american(s.p)}</div>
            <div className="text-[10px] text-muted">{pct(s.p)} · fair</div>
          </div>
        </div>
        <p className="mt-3 flex-1 text-xs leading-relaxed text-muted">{s.analysis}</p>
        <button
          type="button"
          onClick={onLoad}
          className="mt-4 w-full rounded-md border border-line bg-bg/40 px-3 py-2 text-[10px] uppercase tracking-[0.16em] text-zinc-300 hover:border-accent/50 hover:bg-accent/[0.06] hover:text-accent"
        >
          Load into slip →
        </button>
      </div>
    </div>
  );
}

export default function BetLab({ eventId, fights: allFights }: { eventId: string; fights: FightPricing[] }) {
  const [openBout, setOpenBout] = useState<string | null>(null);
  const [slip, setSlip] = useState<Leg[]>([]);
  const [tab, setTab] = useState<"builder" | "suggestions">("suggestions");
  const [, force] = useState(0);

  useEffect(() => {
    if (!allFights.some((f) => inLiveWindow(f.date))) return;
    return subscribe(eventId, () => force((x) => x + 1));
  }, [eventId, allFights]);

  // Only fights that haven't started are biddable: live feed state when we have it,
  // fight time as the fallback.
  const fights = allFights.filter((f) => {
    const b = getBout(eventId, f.boutId);
    if (b) return b.state === "pre";
    return Date.now() < new Date(f.date).getTime();
  });

  useEffect(() => {
    const gone = new Set(fights.map((f) => f.boutId));
    setSlip((s) => s.filter((l) => gone.has(l.boutId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fights.length]);

  const menus = useMemo(() => new Map(fights.map((f) => [f.boutId, legsFor(f)])), [fights]);

  const toggle = (leg: Leg) =>
    setSlip((s) =>
      s.some((l) => l.boutId === leg.boutId && l.label === leg.label)
        ? s.filter((l) => !(l.boutId === leg.boutId && l.label === leg.label))
        : [...s.filter((l) => l.boutId !== leg.boutId), leg]
    );

  const combined = parlayProb(slip);
  const suggestions = useMemo(() => buildSuggestions(fights), [fights]);

  return (
    <section className="mt-10">
      <div className="section-heading flex-wrap" data-index="05">
        <h2>Bet Lab</h2>
        <span className="hidden text-[10px] uppercase tracking-[0.12em] text-muted sm:inline">
          model-priced lines to compare against your book
        </span>
        <div className="segmented-control z-10 ml-auto flex items-center gap-0.5 p-1 text-[10px] uppercase tracking-[0.14em]">
          <button
            type="button"
            onClick={() => setTab("suggestions")}
            aria-pressed={tab === "suggestions"}
            className={`rounded px-2.5 py-1 ${tab === "suggestions" ? "segmented-control__item--active" : "text-muted hover:text-zinc-300"}`}
          >
            Suggestions
          </button>
          <button
            type="button"
            onClick={() => setTab("builder")}
            aria-pressed={tab === "builder"}
            className={`rounded px-2.5 py-1 ${tab === "builder" ? "segmented-control__item--active" : "text-muted hover:text-zinc-300"}`}
          >
            Builder
          </button>
        </div>
      </div>

      {fights.length === 0 ? (
        <p className="terminal-empty p-5 text-xs">
          All fights on this card have started or finished — nothing left to price.
        </p>
      ) : tab === "suggestions" ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {suggestions.map((sg) => (
            <SuggestionCard
              key={sg.title}
              s={sg}
              onLoad={() => {
                setSlip(sg.legs);
                setTab("builder");
              }}
            />
          ))}
          {suggestions.length === 0 && (
            <p className="terminal-empty p-5 text-xs lg:col-span-2">
              Nothing on this card stands out enough to suggest — the model and the market mostly
              agree, and no matchup's finish profile is extreme. That happens.
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-3">
            {fights.map((f) => (
              <div key={f.boutId} className="terminal-panel terminal-panel--interactive">
                <button
                  type="button"
                  onClick={() => setOpenBout((o) => (o === f.boutId ? null : f.boutId))}
                  aria-expanded={openBout === f.boutId}
                  aria-controls={`bet-menu-${f.boutId}`}
                  className="terminal-panel-header flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-white/[0.025]"
                >
                  <span className="display font-extrabold">
                    {lastName(f.aName)} <span className="text-zinc-600">vs</span> {lastName(f.bName)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted">
                    {slip.some((l) => l.boutId === f.boutId) ? "1 leg in slip" : `${menus.get(f.boutId)?.length ?? 0} bets`}
                    <span
                      className={`text-accent transition-transform ${openBout === f.boutId ? "rotate-180" : ""}`}
                    >
                      ↓
                    </span>
                  </span>
                </button>
                {openBout === f.boutId && (
                  <div id={`bet-menu-${f.boutId}`} className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
                    {(menus.get(f.boutId) ?? []).map((leg) => (
                      <LegRow
                        key={leg.label}
                        leg={leg}
                        inSlip={slip.some((l) => l.boutId === leg.boutId && l.label === leg.label)}
                        blocked={slip.some((l) => l.boutId === leg.boutId)}
                        onToggle={() => toggle(leg)}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="terminal-panel h-fit border-accent/30 lg:sticky lg:top-20">
            <div className="terminal-panel-header flex items-center justify-between px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-accent">
              <h3>Model slip</h3>
              <span className="text-muted tabnums">{slip.length} legs</span>
            </div>
            <div className="p-4">
              {slip.length === 0 ? (
                <p className="text-xs text-muted">
                  Pick a fight, add legs. One leg per fight — same-fight legs are correlated and
                  can&apos;t be fairly multiplied.
                </p>
              ) : (
                <>
                  <div className="space-y-1.5 text-xs">
                    {slip.map((l) => (
                      <div
                        key={`${l.boutId}-${l.label}`}
                        className="flex items-baseline justify-between gap-2 border-b border-line/60 py-1.5 last:border-0"
                      >
                        <span className="truncate">{l.label}</span>
                        <span className="shrink-0 tabnums text-muted">
                          {pct(l.p)}
                          <button
                            type="button"
                            onClick={() => toggle(l)}
                            aria-label={`Remove ${l.label}`}
                            className="ml-2 rounded px-1 text-danger"
                          >
                            ×
                          </button>
                        </span>
                      </div>
                    ))}
                  </div>
                  {combined !== null && (
                    <div className="mt-3 border-t border-line pt-2 tabnums">
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-muted">{slip.length}-leg fair price</span>
                        <span className="text-lg font-bold text-accent">{american(combined)}</span>
                      </div>
                      <div className="flex items-baseline justify-between text-xs text-muted">
                        <span>hit probability</span>
                        <span>
                          {pct(combined)} · {fairDecimal(combined).toFixed(2)}x
                        </span>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setSlip([])}
                    className="mt-3 w-full rounded-md border border-line px-2 py-1.5 text-[10px] uppercase tracking-[0.14em] text-muted hover:border-zinc-600 hover:text-zinc-300"
                  >
                    Clear slip
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-[10px] leading-relaxed text-zinc-600">
        Every number here is the model&apos;s fair price, not a betting recommendation. Fighter-prop
        prices assume who-wins and how-it-ends are independent, and round shares come from
        league-wide history — both approximations. Compare against your book&apos;s actual odds and
        make your own calls. 21+, bet responsibly.
      </p>
    </section>
  );
}
