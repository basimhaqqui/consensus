// Resolve player profile (face + bio) by name via TheSportsDB — the one open,
// free source with good international coverage. Cached in-process so each
// player is fetched once; resolved server-side so it's baked into the page.

export type Profile = {
  img: string | null;
  club?: string;
  position?: string;
  nationality?: string;
  born?: string; // YYYY-MM-DD
  height?: string;
  desc?: string;
};

const EMPTY: Profile = { img: null };

const cache = new Map<string, Profile>();
const inflight = new Map<string, Promise<Profile>>();

// When the source rate-limits us (live matches re-resolve every poll), back
// off briefly instead of stampeding — unresolved players retry next cycle.
let cooldownUntil = 0;

// the current public test key is "123" (the old "3" is heavily throttled);
// set THESPORTSDB_KEY to a personal free key for reliable, instant coverage.
const KEY = process.env.THESPORTSDB_KEY || "123";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

async function lookup(
  name: string,
  nat: string, // team context: country for national sides, club otherwise
  band?: string // GK/DEF/MID/FWD hint from the actual lineup, when known
): Promise<Profile> {
  if (Date.now() < cooldownUntil) throw new Error("rate-limit cooldown");
  const url =
    `https://www.thesportsdb.com/api/v1/json/${KEY}/searchplayers.php?p=` +
    encodeURIComponent(name);
  // hard timeout so a slow/hanging source can never block the page
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  let r: Response;
  try {
    r = await fetch(url, { signal: ctrl.signal, next: { revalidate: 604800 } });
  } finally {
    clearTimeout(timer);
  }
  if (!r.ok) {
    cooldownUntil = Date.now() + 60_000;
    throw new Error(`thesportsdb ${r.status}`); // don't cache rate-limits
  }
  const ct = r.headers.get("content-type") ?? "";
  if (!ct.includes("json")) {
    cooldownUntil = Date.now() + 60_000;
    throw new Error("thesportsdb non-json (rate limit)");
  }
  const j = (await r.json()) as { player?: any[] };
  const list = (j.player ?? []).filter((p) => p.strSport === "Soccer");
  if (!list.length) return EMPTY;

  // Identity gate: the search is fuzzy (querying "Rodri" can return only
  // "Jay Rodriguez"), so a candidate must be tied to the player's team
  // context — national side (nationality) or club (team name) — before we
  // trust it. No confirmed candidate → no profile; a missing face is far
  // better than the wrong person's.
  const ctxN = norm(nat);
  const confirmed = ctxN
    ? list.filter((p) => {
        const pNat = norm(p.strNationality ?? "");
        const pTeam = norm(p.strTeam ?? "");
        return (
          pNat === ctxN ||
          (pTeam.length > 2 && (pTeam === ctxN || pTeam.includes(ctxN) || ctxN.includes(pTeam)))
        );
      })
    : list;
  if (!confirmed.length) return EMPTY;

  // Among confirmed candidates, prefer a matching position band, then the
  // one with a proper cutout image, then the closer name.
  const bandOf = (pos?: string): string => {
    const f = (pos ?? "").toLowerCase();
    if (f.includes("keeper")) return "GK";
    if (f.includes("back") || f.includes("defen")) return "DEF";
    if (f.includes("midfield")) return "MID";
    if (f.includes("wing") || f.includes("forward") || f.includes("striker"))
      return "FWD";
    return "";
  };
  const nameN = norm(name);
  const score = (p: any) =>
    (band && bandOf(p.strPosition) === band ? 4 : 0) +
    (p.strCutout ? 2 : 0) +
    (norm(p.strPlayer ?? "") === nameN ? 1 : 0);
  const m = [...confirmed].sort((a, b) => score(b) - score(a))[0];
  const desc: string | undefined = m.strDescriptionEN || undefined;
  return {
    img: m.strCutout || m.strThumb || null,
    club: m.strTeam || undefined,
    position: m.strPosition || undefined,
    nationality: m.strNationality || undefined,
    born: m.dateBorn || undefined,
    height: m.strHeight || undefined,
    desc: desc ? desc.slice(0, 320).trim() : undefined,
  };
}

export async function resolveProfile(
  name: string,
  nat: string,
  band?: string
): Promise<Profile> {
  if (!name) return EMPTY;
  const key = `${norm(name)}|${norm(nat)}|${band ?? ""}`;
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;

  const p = lookup(name, nat, band)
    .then((v) => {
      cache.set(key, v);
      inflight.delete(key);
      return v;
    })
    .catch(() => {
      inflight.delete(key); // rate-limit/error: don't cache, allow retry
      return EMPTY;
    });
  inflight.set(key, p);
  return p;
}

// Resolve a batch with limited concurrency + an overall deadline, so a slow
// source degrades gracefully (unresolved players fall back, retried next load).
export async function resolveBatch(
  items: { name: string; nat: string; band?: string }[],
  concurrency = 4,
  deadlineMs = 6000
): Promise<Profile[]> {
  const out: Profile[] = new Array(items.length).fill(EMPTY);
  const start = Date.now();
  let i = 0;
  async function worker() {
    while (i < items.length) {
      if (Date.now() - start > deadlineMs) return; // bail; leave EMPTY
      const idx = i++;
      out[idx] = await resolveProfile(
        items[idx].name,
        items[idx].nat,
        items[idx].band
      );
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker)
  );
  return out;
}
