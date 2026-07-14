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
      className={`flex w-full items-baseline justify-between gap-2 rounded-md border px-2.5 py-1.5 text-left text-xs ${
        inSlip
          ? "border-accent/60 bg-accent/10"
          : blocked
            ? "border-line/50 text-zinc-600 cursor-not-allowed"
            : "border-line hover:border-accent/40"
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
    <div className="terminal-panel terminal-panel--interactive flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${KIND_TONE[s.kind]}`}>
            {KIND_LABEL[s.kind]}
          </span>
          <h3 className="display mt-1.5 text-base font-extrabold leading-tight">{s.title}</h3>
        </div>
        <div className="shrink-0 text-right tabnums">
          <div className="text-lg font-bold text-zinc-100">{american(s.p)}</div>
          <div className="text-[10px] text-muted">{pct(s.p)} · fair</div>
        </div>
      </div>
      <p className="mt-2 flex-1 text-xs text-muted leading-relaxed">{s.analysis}</p>
      <button
        type="button"
        onClick={onLoad}
        className="mt-3 w-full rounded-md border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-zinc-300 hover:border-accent/50 hover:text-accent"
      >
        Load into slip →
      </button>
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
      <div className="section-heading" data-index="05">
        <h2>Bet Lab</h2>
        <span className="text-[11px] text-muted">model-priced lines to compare against your book</span>
        <div className="segmented-control z-10 ml-auto flex items-center gap-0.5 p-0.5 text-[10px] uppercase tracking-wider">
          <button
            type="button"
            onClick={() => setTab("suggestions")}
            className={`rounded px-2 py-0.5 ${tab === "suggestions" ? "bg-accent/20 text-accent" : "text-muted"}`}
          >
            Suggestions
          </button>
          <button
            type="button"
            onClick={() => setTab("builder")}
            className={`rounded px-2 py-0.5 ${tab === "builder" ? "bg-accent/20 text-accent" : "text-muted"}`}
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
        <div className="grid gap-4 lg:grid-cols-2">
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
        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-2">
            {fights.map((f) => (
              <div key={f.boutId} className="terminal-panel">
                <button
                  type="button"
                  onClick={() => setOpenBout((o) => (o === f.boutId ? null : f.boutId))}
                  className="flex w-full items-center justify-between px-4 py-2 text-left text-sm hover:bg-panel2/60"
                >
                  <span className="display font-extrabold">
                    {lastName(f.aName)} <span className="text-zinc-600">vs</span> {lastName(f.bName)}
                  </span>
                  <span className="text-[10px] text-muted uppercase tracking-wider">
                    {slip.some((l) => l.boutId === f.boutId) ? "1 leg in slip" : `${menus.get(f.boutId)?.length ?? 0} bets`}
                  </span>
                </button>
                {openBout === f.boutId && (
                  <div className="grid gap-1.5 border-t border-line p-3 sm:grid-cols-2">
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

          <div className="terminal-panel h-fit border-accent/30 p-4 lg:sticky lg:top-4">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-accent mb-2">Slip</h3>
            {slip.length === 0 ? (
              <p className="text-xs text-muted">
                Pick a fight, add legs. One leg per fight — same-fight legs are correlated and
                can&apos;t be fairly multiplied.
              </p>
            ) : (
              <>
                <div className="space-y-1.5 text-xs">
                  {slip.map((l) => (
                    <div key={`${l.boutId}-${l.label}`} className="flex items-baseline justify-between gap-2">
                      <span className="truncate">{l.label}</span>
                      <span className="shrink-0 tabnums text-muted">
                        {pct(l.p)}
                        <button type="button" onClick={() => toggle(l)} className="ml-2 text-danger">
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
                  className="mt-3 w-full rounded-md border border-line px-2 py-1 text-[10px] uppercase tracking-wider text-muted hover:text-zinc-300"
                >
                  Clear slip
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <p className="mt-3 text-[10px] text-zinc-600 leading-relaxed max-w-3xl">
        Every number here is the model&apos;s fair price, not a betting recommendation. Fighter-prop
        prices assume who-wins and how-it-ends are independent, and round shares come from
        league-wide history — both approximations. Compare against your book&apos;s actual odds and
        make your own calls. 21+, bet responsibly.
      </p>
    </section>
  );
}
