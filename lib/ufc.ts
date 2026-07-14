export type Stance = "Orthodox" | "Southpaw" | "Switch";

export type FighterProfile = {
  name: string;
  nickname?: string;
  record: string;
  country: string;
  age: number;
  heightIn: number;
  reachIn: number;
  stance: Stance;
  striking: number;
  grappling: number;
  cardio: number;
  durability: number;
};

export type Fight = {
  id: string;
  weightClass: string;
  rounds: 3 | 5;
  red: FighterProfile;
  blue: FighterProfile;
  market: {
    redAmerican: number;
    blueAmerican: number;
    books: string;
  };
  analystPickShare: {
    red: number;
    blue: number;
  };
};

export type FightProjection = {
  fight: Fight;
  modelRed: number;
  modelBlue: number;
  marketRed: number;
  marketBlue: number;
  consensusRed: number;
  consensusBlue: number;
  edgeRed: number;
  edgeBlue: number;
  pick: "red" | "blue";
  confidence: number;
  methodRead: string;
};

export const UFC_EVENT = {
  name: "UFC Consensus Starter Card",
  date: "Seed data",
  venue: "Model sandbox",
  note:
    "Static sample card used to build the product surface before wiring live UFC schedule, odds, and media-pick feeds.",
};

export const UFC_FIGHTS: Fight[] = [
  {
    id: "makhachev-topuria",
    weightClass: "Lightweight",
    rounds: 5,
    red: {
      name: "Islam Makhachev",
      record: "27-1",
      country: "Russia",
      age: 34,
      heightIn: 70,
      reachIn: 70,
      stance: "Southpaw",
      striking: 88,
      grappling: 97,
      cardio: 91,
      durability: 92,
    },
    blue: {
      name: "Ilia Topuria",
      nickname: "El Matador",
      record: "17-0",
      country: "Georgia / Spain",
      age: 29,
      heightIn: 67,
      reachIn: 69,
      stance: "Orthodox",
      striking: 95,
      grappling: 88,
      cardio: 88,
      durability: 91,
    },
    market: { redAmerican: -155, blueAmerican: +130, books: "seed" },
    analystPickShare: { red: 0.58, blue: 0.42 },
  },
  {
    id: "du-plessis-chimaev",
    weightClass: "Middleweight",
    rounds: 5,
    red: {
      name: "Dricus Du Plessis",
      nickname: "Stillknocks",
      record: "23-2",
      country: "South Africa",
      age: 32,
      heightIn: 73,
      reachIn: 76,
      stance: "Switch",
      striking: 88,
      grappling: 86,
      cardio: 93,
      durability: 94,
    },
    blue: {
      name: "Khamzat Chimaev",
      nickname: "Borz",
      record: "15-0",
      country: "UAE / Chechnya",
      age: 32,
      heightIn: 74,
      reachIn: 75,
      stance: "Orthodox",
      striking: 84,
      grappling: 96,
      cardio: 87,
      durability: 90,
    },
    market: { redAmerican: +115, blueAmerican: -135, books: "seed" },
    analystPickShare: { red: 0.46, blue: 0.54 },
  },
  {
    id: "zhang-suarez",
    weightClass: "Women’s Strawweight",
    rounds: 5,
    red: {
      name: "Zhang Weili",
      nickname: "Magnum",
      record: "26-3",
      country: "China",
      age: 36,
      heightIn: 64,
      reachIn: 63,
      stance: "Switch",
      striking: 91,
      grappling: 87,
      cardio: 94,
      durability: 90,
    },
    blue: {
      name: "Tatiana Suarez",
      record: "11-1",
      country: "United States",
      age: 35,
      heightIn: 65,
      reachIn: 66,
      stance: "Southpaw",
      striking: 78,
      grappling: 96,
      cardio: 88,
      durability: 86,
    },
    market: { redAmerican: -125, blueAmerican: +105, books: "seed" },
    analystPickShare: { red: 0.55, blue: 0.45 },
  },
  {
    id: "holloway-gaethje",
    weightClass: "BMF / Lightweight",
    rounds: 5,
    red: {
      name: "Max Holloway",
      nickname: "Blessed",
      record: "27-8",
      country: "United States",
      age: 34,
      heightIn: 71,
      reachIn: 69,
      stance: "Orthodox",
      striking: 94,
      grappling: 78,
      cardio: 96,
      durability: 95,
    },
    blue: {
      name: "Justin Gaethje",
      nickname: "The Highlight",
      record: "25-5",
      country: "United States",
      age: 37,
      heightIn: 71,
      reachIn: 70,
      stance: "Orthodox",
      striking: 91,
      grappling: 80,
      cardio: 88,
      durability: 89,
    },
    market: { redAmerican: -165, blueAmerican: +140, books: "seed" },
    analystPickShare: { red: 0.64, blue: 0.36 },
  },
];

function clamp(n: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, n));
}

function americanToProbability(odds: number) {
  if (odds < 0) return Math.abs(odds) / (Math.abs(odds) + 100);
  return 100 / (odds + 100);
}

function noVigMarket(redAmerican: number, blueAmerican: number) {
  const redRaw = americanToProbability(redAmerican);
  const blueRaw = americanToProbability(blueAmerican);
  const total = redRaw + blueRaw;
  return { red: redRaw / total, blue: blueRaw / total };
}

function fighterRating(f: FighterProfile) {
  const primeAgePenalty = Math.max(0, f.age - 34) * 0.9;
  return (
    f.striking * 0.34 +
    f.grappling * 0.34 +
    f.cardio * 0.18 +
    f.durability * 0.14 -
    primeAgePenalty
  );
}

function logistic(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function modelProbability(red: FighterProfile, blue: FighterProfile, rounds: 3 | 5) {
  const ratingDiff = fighterRating(red) - fighterRating(blue);
  const reachDiff = (red.reachIn - blue.reachIn) * 0.35;
  const fiveRoundAdjustment = rounds === 5 ? (red.cardio - blue.cardio) * 0.025 : 0;
  return logistic((ratingDiff + reachDiff + fiveRoundAdjustment) / 8);
}

function methodRead(fight: Fight, pick: "red" | "blue") {
  const winner = fight[pick];
  const loser = fight[pick === "red" ? "blue" : "red"];
  const strikingGap = winner.striking - loser.striking;
  const grapplingGap = winner.grappling - loser.grappling;
  const cardioGap = winner.cardio - loser.cardio;

  if (grapplingGap >= 7) return "grappling control and top-position minutes";
  if (strikingGap >= 7) return "cleaner striking and damage upside";
  if (cardioGap >= 6 && fight.rounds === 5) return "five-round pace and late-fight durability";
  return "balanced profile with fewer obvious failure points";
}

export function projectFight(fight: Fight): FightProjection {
  const modelRed = modelProbability(fight.red, fight.blue, fight.rounds);
  const modelBlue = 1 - modelRed;
  const market = noVigMarket(fight.market.redAmerican, fight.market.blueAmerican);

  const consensusRed = clamp(
    modelRed * 0.55 + market.red * 0.3 + fight.analystPickShare.red * 0.15
  );
  const consensusBlue = 1 - consensusRed;
  const pick = consensusRed >= consensusBlue ? "red" : "blue";

  return {
    fight,
    modelRed,
    modelBlue,
    marketRed: market.red,
    marketBlue: market.blue,
    consensusRed,
    consensusBlue,
    edgeRed: modelRed - market.red,
    edgeBlue: modelBlue - market.blue,
    pick,
    confidence: Math.abs(consensusRed - consensusBlue),
    methodRead: methodRead(fight, pick),
  };
}

export function getUfcProjections() {
  return UFC_FIGHTS.map(projectFight).sort(
    (a, b) => b.confidence - a.confidence
  );
}
