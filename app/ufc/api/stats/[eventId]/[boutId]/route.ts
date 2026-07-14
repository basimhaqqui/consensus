import { NextResponse } from "next/server";

// Per-bout fight stats (live and final) from ESPN's core API, trimmed to the numbers
// a fight fan actually reads. Short revalidate so an open panel tracks a live fight.

type StatLine = {
  kd: number;
  sig: string;
  total: string;
  td: string;
  sub: number;
  ctrl: string;
};

const pick = (stats: { name: string; displayValue: string }[], name: string) =>
  stats.find((s) => s.name === name)?.displayValue ?? "0";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ eventId: string; boutId: string }> }
) {
  const { eventId, boutId } = await params;
  if (!/^\d+$/.test(eventId) || !/^\d+$/.test(boutId))
    return NextResponse.json({ error: "bad ids" }, { status: 400 });

  const comp = await fetch(
    `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${eventId}/competitions/${boutId}?lang=en&region=us`,
    { next: { revalidate: 15 } }
  ).then((r) => (r.ok ? r.json() : null));
  if (!comp) return NextResponse.json({ byId: {} }, { headers: { "cache-control": "public, max-age=20" } });

  const byId: Record<string, StatLine> = {};
  await Promise.all(
    (comp.competitors ?? []).map(async (c: { id: string }) => {
      const d = await fetch(
        `https://sports.core.api.espn.com/v2/sports/mma/leagues/ufc/events/${eventId}/competitions/${boutId}/competitors/${c.id}/statistics?lang=en&region=us`,
        { next: { revalidate: 15 } }
      ).then((r) => (r.ok ? r.json() : null));
      const stats = d?.splits?.categories?.[0]?.stats;
      if (!stats) return;
      byId[String(c.id)] = {
        kd: Number(pick(stats, "knockDowns")),
        sig: `${pick(stats, "sigStrikesLanded")}/${pick(stats, "sigStrikesAttempted")}`,
        total: `${pick(stats, "totalStrikesLanded")}/${pick(stats, "totalStrikesAttempted")}`,
        td: `${pick(stats, "takedownsLanded")}/${pick(stats, "takedownsAttempted")}`,
        sub: Number(pick(stats, "submissions")),
        ctrl: pick(stats, "timeInControl"),
      };
    })
  );

  return NextResponse.json({ byId }, { headers: { "cache-control": "public, max-age=15" } });
}
