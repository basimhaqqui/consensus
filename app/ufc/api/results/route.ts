import { NextResponse } from "next/server";
import fightsJson from "@/data/ufc/fights.json";
import methodsJson from "@/data/ufc/methods.json";

// Final results for a set of bouts, from the repo's own graded history — lets the picks
// page grade anything the live feed missed (browser closed during the card, etc.).

type FightRow = {
  boutId: string;
  a: { id: string };
  b: { id: string };
  winnerId: string | null;
  round: number | null;
  decision: boolean;
};

const fights = fightsJson as unknown as FightRow[];
const methods = methodsJson as unknown as Record<string, string>;

const classify = (m: string | undefined) => {
  if (!m) return null;
  if (m === "kotko" || m.startsWith("tko")) return "ko";
  if (m.startsWith("submission")) return "sub";
  if ((m.startsWith("decision") || m === "majority-decision") && !m.includes("draw")) return "dec";
  return null;
};

const byBout = new Map(fights.map((f) => [f.boutId, f]));

export async function GET(req: Request) {
  const ids = (new URL(req.url).searchParams.get("bouts") ?? "")
    .split(",")
    .filter((s) => /^\d+$/.test(s))
    .slice(0, 100);

  const out: Record<string, { winnerAId: string | null; winnerId: string | null; method: string | null; round: number | null }> = {};
  for (const id of ids) {
    const f = byBout.get(id);
    if (!f) continue;
    const method = classify(methods[id]);
    out[id] = {
      winnerAId: String(f.a.id),
      winnerId: f.winnerId === null ? null : String(f.winnerId),
      method,
      round: method && method !== "dec" ? f.round : null,
    };
  }
  return NextResponse.json({ results: out }, { headers: { "cache-control": "public, max-age=300" } });
}
