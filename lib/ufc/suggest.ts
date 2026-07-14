// Suggestion engine for the Bet Lab: scans a card's model pricing and emits the bets the
// numbers actually distinguish — moneyline edges vs books, standout props, and parlays —
// each with an analysis composed from the model internals that produced it.

import { american, type FightPricing, type Leg } from "@/lib/ufc/betmath";

// League base rates (all classified UFC results, modern era) — the yardstick that makes
// "this fight trends X" a real claim instead of vibes.
const BASE = { ko: 0.34, sub: 0.2, dec: 0.46, finish: 0.54 };

export type Suggestion = {
  kind: "edge" | "prop" | "parlay";
  title: string;
  legs: Leg[];
  p: number;
  analysis: string;
};

const last = (n: string | null) => (n ?? "").split(" ").slice(1).join(" ") || (n ?? "?");
const pc = (n: number) => `${(n * 100).toFixed(0)}%`;

function favOf(f: FightPricing) {
  const aFav = f.pA >= 0.5;
  return {
    name: last(aFav ? f.aName : f.bName),
    dogName: last(aFav ? f.bName : f.aName),
    p: aFav ? f.pA : 1 - f.pA,
    rating: aFav ? f.ratingA : f.ratingB,
    dogRating: aFav ? f.ratingB : f.ratingA,
    prov: (aFav ? f.fightsB : f.fightsA) < 5, // is the DOG provisional
    favProv: (aFav ? f.fightsA : f.fightsB) < 5,
  };
}

function edgeSuggestions(fights: FightPricing[]): Suggestion[] {
  return fights
    .filter((f) => f.bookPA !== null)
    .map((f) => {
      const gap = f.pA - (f.bookPA as number);
      const aSide = gap > 0;
      const name = last(aSide ? f.aName : f.bName);
      const p = aSide ? f.pA : 1 - f.pA;
      const bookP = aSide ? (f.bookPA as number) : 1 - (f.bookPA as number);
      const rating = aSide ? f.ratingA : f.ratingB;
      const oppRating = aSide ? f.ratingB : f.ratingA;
      const provNote =
        (aSide ? f.fightsB : f.fightsA) < 5
          ? ` One caveat: the other corner is provisional (fewer than 5 UFC fights), so the model's read there is soft — these are exactly the spots where books know things Elo can't.`
          : ` Both fighters are established, so the rating gap is well-earned data.`;
      return {
        kind: "edge" as const,
        title: `${name} moneyline`,
        legs: [{ boutId: f.boutId, label: `${name} wins`, p }],
        p,
        edge: Math.abs(gap),
        analysis:
          `The model prices ${name} at ${pc(p)}; the de-vigged book average sits at ${pc(bookP)} — a ${Math.round(Math.abs(gap) * 100)}-point disagreement. ` +
          `The model's case is Elo: ${rating} vs ${oppRating}, a ${Math.abs(rating - oppRating)}-point rating gap built from every UFC result since 1993.` +
          provNote,
      };
    })
    .filter((e) => e.edge >= 0.05)
    .sort((x, y) => y.edge - x.edge)
    .slice(0, 3)
    .map(({ edge: _edge, ...s }) => s);
}

function propSuggestions(fights: FightPricing[]): Suggestion[] {
  const out: (Suggestion & { score: number })[] = [];
  for (const f of fights) {
    const m = f.method;
    if (!m) continue;
    const finish = m.ko + m.sub;
    const fav = favOf(f);
    const matchup = `${last(f.aName)} vs ${last(f.bName)}`;

    if (m.dec >= 0.58) {
      out.push({
        kind: "prop",
        title: `${matchup} goes the distance`,
        legs: [{ boutId: f.boutId, label: `Goes the distance`, p: m.dec }],
        p: m.dec,
        score: m.dec - BASE.dec,
        analysis:
          `The method model puts ${pc(m.dec)} on the scorecards — well above the ${pc(BASE.dec)} league base rate. ` +
          `Both fighters' finish tendencies run low here (KO ${pc(m.ko)}, SUB ${pc(m.sub)} combined for the fight). ` +
          `Fair price ${american(m.dec)}; a plus price at your book is model-positive.`,
      });
    }

    if (finish >= 0.62) {
      out.push({
        kind: "prop",
        title: `${matchup} doesn't go the distance`,
        legs: [{ boutId: f.boutId, label: `Doesn't go the distance`, p: finish }],
        p: finish,
        score: finish - BASE.finish,
        analysis:
          `${pc(finish)} that someone gets finished (league base: ${pc(BASE.finish)}). ` +
          `The split is KO/TKO ${pc(m.ko)}, submission ${pc(m.sub)} — this pairing's history rarely reaches the judges. Fair ${american(finish)}.`,
      });
    }

    const pITD = fav.p * finish;
    if (pITD >= 0.4 && fav.p >= 0.6) {
      out.push({
        kind: "prop",
        title: `${fav.name} inside the distance`,
        legs: [{ boutId: f.boutId, label: `${fav.name} inside the distance`, p: pITD }],
        p: pITD,
        score: pITD - 0.28,
        analysis:
          `Two conditions multiply here: ${fav.name} wins ${pc(fav.p)} of the time by the model (Elo ${fav.rating} vs ${fav.dogRating}), ` +
          `and this fight finishes ${pc(finish)} of the time. Together that's ${pc(pITD)} — fair ${american(pITD)}. ` +
          `Assumes who-wins and how-it-ends are independent, which is the honest simplification (dominant favorites usually finish more, so this may even be conservative).`,
      });
    }

    const pKO = fav.p * m.ko;
    if (pKO >= 0.35 && m.ko >= 0.5) {
      out.push({
        kind: "prop",
        title: `${fav.name} by KO/TKO`,
        legs: [{ boutId: f.boutId, label: `${fav.name} by KO/TKO`, p: pKO }],
        p: pKO,
        score: pKO - 0.2,
        analysis:
          `This fight's KO probability alone is ${pc(m.ko)} (league base ${pc(BASE.ko)}) — both corners' fights end in strikes far more than average — ` +
          `and ${fav.name} is the ${pc(fav.p)} favorite. The product prices the prop at ${pc(pKO)}, fair ${american(pKO)}.`,
      });
    }
  }
  return out
    .sort((x, y) => y.score - x.score)
    .slice(0, 4)
    .map(({ score: _s, ...s }) => s);
}

function parlaySuggestions(fights: FightPricing[], props: Suggestion[]): Suggestion[] {
  const out: Suggestion[] = [];

  // Safest-favorites triple — the classic card parlay, priced honestly.
  const favs = fights
    .map((f) => {
      const fav = favOf(f);
      return { boutId: f.boutId, label: `${fav.name} wins`, p: fav.p, fav };
    })
    .sort((x, y) => y.p - x.p)
    .slice(0, 3);
  if (favs.length === 3) {
    const p = favs.reduce((s, l) => s * l.p, 1);
    out.push({
      kind: "parlay",
      title: `Favorites triple: ${favs.map((l) => l.fav.name).join(" + ")}`,
      legs: favs.map(({ fav: _f, ...l }) => l),
      p,
      analysis:
        `The card's three most secure moneylines by Elo: ` +
        favs.map((l) => `${l.fav.name} ${pc(l.p)} (${l.fav.rating} vs ${l.fav.dogRating})`).join(", ") +
        `. Independent fights multiply: ${favs.map((l) => pc(l.p)).join(" × ")} = ${pc(p)}, fair ${american(p)}. ` +
        `Parlays are how books tax optimism — only take this above the fair number.`,
    });
  }

  // Prop parlay — two standout props from different fights.
  const distinct: Suggestion[] = [];
  for (const s of props) {
    if (distinct.some((d) => d.legs[0].boutId === s.legs[0].boutId)) continue;
    distinct.push(s);
    if (distinct.length === 2) break;
  }
  if (distinct.length === 2) {
    const legs = distinct.map((d) => d.legs[0]);
    const p = legs[0].p * legs[1].p;
    out.push({
      kind: "parlay",
      title: `Prop double: ${legs.map((l) => l.label).join(" + ")}`,
      legs,
      p,
      analysis:
        `The two most distinctive props on the card, different fights so the multiplication is legitimate: ` +
        `${legs[0].label.toLowerCase()} at ${pc(legs[0].p)}, ${legs[1].label.toLowerCase()} at ${pc(legs[1].p)}. ` +
        `Combined ${pc(p)}, fair ${american(p)}. Each leg's reasoning is above — the parlay is only as good as its weakest read.`,
    });
  }

  // Edge + prop mixed ticket when both exist on different fights.
  return out;
}

export function buildSuggestions(fights: FightPricing[]): Suggestion[] {
  const edges = edgeSuggestions(fights);
  const props = propSuggestions(fights);
  const parlays = parlaySuggestions(fights, props);
  return [...edges, ...props, ...parlays];
}
