// National-team crest lookup via TheSportsDB. ESPN only ships country FLAGS
// for internationals; the federation badge (Three Lions, the DFB eagle…) is
// what gives lineup cards and headers real identity. Club logos from ESPN are
// already crests, so this is only consulted for country flags.

const KEY = process.env.THESPORTSDB_KEY || "123";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

// ESPN display name → the name TheSportsDB indexes the senior side under.
const ALIAS: Record<string, string> = {
  "united states": "USA",
  "bosnia-herzegovina": "Bosnia",
  "congo dr": "DR Congo",
  turkiye: "Turkey",
  czechia: "Czech Republic",
  "korea republic": "South Korea",
  "ir iran": "Iran",
};

const cache = new Map<string, string | null>();
const inflight = new Map<string, Promise<string | null>>();

async function lookup(name: string): Promise<string | null> {
  const q = ALIAS[norm(name)] ?? name;
  const url =
    `https://www.thesportsdb.com/api/v1/json/${KEY}/searchteams.php?t=` +
    encodeURIComponent(q);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  let r: Response;
  try {
    r = await fetch(url, { signal: ctrl.signal, next: { revalidate: 604800 } });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) throw new Error(`thesportsdb ${r.status}`);
  const ct = r.headers.get("content-type") ?? "";
  if (!ct.includes("json")) throw new Error("thesportsdb non-json (rate limit)");
  const j = (await r.json()) as { teams?: any[] };
  // Senior men's national sides are indexed under the "FIFA World Cup" league —
  // this also screens out U17/U20/women's teams that share the name.
  const senior = (j.teams ?? []).filter(
    (t) => t.strSport === "Soccer" && (t.strLeague ?? "") === "FIFA World Cup"
  );
  const pick = senior.find((t) => norm(t.strTeam) === norm(q)) ?? senior[0];
  return pick?.strBadge ?? null;
}

// Federation badge for a national team, or null if unknown (caller keeps the
// flag). Cached in-process; errors (rate limits) are not cached so they retry.
export async function nationalBadge(name: string): Promise<string | null> {
  if (!name) return null;
  const key = norm(name);
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = lookup(name)
    .then((v) => {
      cache.set(key, v);
      inflight.delete(key);
      return v;
    })
    .catch(() => {
      inflight.delete(key);
      return null;
    });
  inflight.set(key, p);
  return p;
}
