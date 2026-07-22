import { cache } from "react";
import { getClubSignal } from "./clubSignals";
import { getBoards } from "./live";
import {
  consensusPA,
  getBookLine,
  getCards,
  type FighterRef,
} from "./ufc/data";

export type ShareSignalSport = "football" | "ufc";

export type ShareSignalSide = {
  name: string;
  code: string;
  logo?: string;
  teamKey?: string;
  fighter?: FighterRef;
};

export type ShareSignal = {
  id: string;
  sport: ShareSignalSport;
  destination: string;
  sharePath: string;
  desk: string;
  event: string;
  date: string;
  meta: string;
  left: ShareSignalSide;
  right: ShareSignalSide;
  pickSide: "left" | "right";
  pickName: string;
  opponentName: string;
  outcomeLabel: "to win" | "to advance";
  methodLabel: "Consensus" | "Independent model";
  probability: number;
  modelProbability: number;
  marketProbability?: number;
  reason: string;
  caption: string;
  actionLabel: string;
};

const pct = (value: number) => `${Math.round(value * 100)}%`;

export const getShareSignal = cache(
  async (
    sport: string,
    id: string
  ): Promise<ShareSignal | null> => {
    if (sport === "football") return footballSignal(id);
    if (sport === "ufc") return ufcSignal(id);
    return null;
  }
);

async function footballSignal(id: string): Promise<ShareSignal | null> {
  if (id.startsWith("club_")) return clubFootballSignal(id);

  const boards = await getBoards();
  const match = boards.blend.matches.find((item) => item.id === id);
  if (!match || match.status === "final") return null;

  const model = boards.model.matches.find((item) => item.id === id) ?? match;
  const advance = match.liveAdvance ?? match.advance;
  const modelAdvance = model.liveAdvance ?? model.advance;
  const pickLeft = advance.home >= advance.away;
  const pick = pickLeft ? match.home : match.away;
  const opponent = pickLeft ? match.away : match.home;
  const probability = pickLeft ? advance.home : advance.away;
  const modelProbability = pickLeft ? modelAdvance.home : modelAdvance.away;
  const marketProbability = model.market
    ? pickLeft
      ? model.market.advHome
      : 1 - model.market.advHome
    : undefined;
  const reason = comparisonReason(
    pick.name,
    probability,
    modelProbability,
    marketProbability,
    "advance"
  );

  return {
    id,
    sport: "football",
    destination: `/match/${id}`,
    sharePath: `/signal/football/${id}`,
    desk: match.status === "live" ? "Football · live signal" : "Football · World Cup",
    event: roundLabel(id),
    date: match.status === "live" ? match.live?.detail ?? "Live" : match.date,
    meta: match.venue,
    left: {
      name: match.home.name,
      code: match.home.code,
      teamKey: match.homeKey,
    },
    right: {
      name: match.away.name,
      code: match.away.code,
      teamKey: match.awayKey,
    },
    pickSide: pickLeft ? "left" : "right",
    pickName: pick.name,
    opponentName: opponent.name,
    outcomeLabel: "to advance",
    methodLabel: "Consensus",
    probability,
    modelProbability,
    marketProbability,
    reason,
    caption: `${pick.name} is the consensus call at ${pct(
      probability
    )} to advance against ${opponent.name}. ${reason} #WorldCup2026`,
    actionLabel: "Open match briefing",
  };
}

async function clubFootballSignal(id: string): Promise<ShareSignal | null> {
  const signal = await getClubSignal(id);
  if (!signal) return null;

  const reason = signal.reasons.join(" ");
  const hashtag = signal.competitionShort.replace(/[^a-z0-9]/gi, "");

  return {
    id,
    sport: "football",
    destination: signal.destination,
    sharePath: signal.sharePath,
    desk: signal.status === "in"
      ? `${signal.competitionShort} · live signal`
      : `${signal.competitionShort} · club forecast`,
    event: signal.competition,
    date: signal.date,
    meta: signal.meta,
    left: signal.left,
    right: signal.right,
    pickSide: signal.pickSide,
    pickName: signal.pickName,
    opponentName: signal.opponentName,
    outcomeLabel: "to win",
    methodLabel: signal.marketProbability === undefined
      ? "Independent model"
      : "Consensus",
    probability: signal.probability,
    modelProbability: signal.modelProbability,
    marketProbability: signal.marketProbability,
    reason,
    caption: `${signal.pickName} is the ${
      signal.marketProbability === undefined ? "independent model" : "consensus"
    } call at ${pct(
      signal.probability
    )} to beat ${signal.opponentName}. ${signal.reasons[1]} #${hashtag}`,
    actionLabel: "Open match briefing",
  };
}

function ufcSignal(id: string): ShareSignal | null {
  for (const card of getCards()) {
    const fight = card.fights.find((item) => item.boutId === id);
    if (!fight) continue;

    const consensus = consensusPA(fight);
    const pickLeft = consensus.p >= 0.5;
    const pick = pickLeft ? fight.a : fight.b;
    const opponent = pickLeft ? fight.b : fight.a;
    const probability = pickLeft ? consensus.p : 1 - consensus.p;
    const modelProbability = pickLeft ? fight.pA : 1 - fight.pA;
    const book = getBookLine(fight.boutId);
    const marketProbability = book
      ? pickLeft
        ? book.pA
        : 1 - book.pA
      : undefined;
    const pickName = pick.name ?? "The consensus pick";
    const opponentName = opponent.name ?? "the opponent";
    const reason = comparisonReason(
      pickName,
      probability,
      modelProbability,
      marketProbability,
      "win"
    );

    return {
      id,
      sport: "ufc",
      destination: `/ufc/event/${card.eventId}#bout-${fight.boutId}`,
      sharePath: `/signal/ufc/${id}`,
      desk: "UFC · fight forecast",
      event: card.name,
      date: formatDate(fight.date),
      meta: fight.weightClass ?? "Scheduled bout",
      left: {
        name: fight.a.name ?? "TBD",
        code: lastName(fight.a.name),
        fighter: fight.a,
      },
      right: {
        name: fight.b.name ?? "TBD",
        code: lastName(fight.b.name),
        fighter: fight.b,
      },
      pickSide: pickLeft ? "left" : "right",
      pickName,
      opponentName,
      outcomeLabel: "to win",
      methodLabel: "Consensus",
      probability,
      modelProbability,
      marketProbability,
      reason,
      caption: `${pickName} is the consensus call at ${pct(
        probability
      )} to beat ${opponentName}. ${reason} #UFC`,
      actionLabel: "Open fight briefing",
    };
  }
  return null;
}

function comparisonReason(
  pickName: string,
  probability: number,
  modelProbability: number,
  marketProbability: number | undefined,
  outcome: "advance" | "win"
) {
  if (marketProbability === undefined) {
    return `The independent model gives ${pickName} a ${pct(
      modelProbability
    )} chance to ${outcome}.`;
  }

  const gap = modelProbability - marketProbability;
  if (Math.abs(gap) >= 0.08) {
    return `${gap > 0 ? "Our model" : "Sportsbooks"} rates ${pickName} ${Math.abs(
      Math.round(gap * 100)
    )} points higher than ${gap > 0 ? "the market" : "our model"}.`;
  }

  return `Model ${pct(modelProbability)} and books ${pct(
    marketProbability
  )} combine for a ${pct(probability)} consensus.`;
}

function roundLabel(id: string) {
  if (id.startsWith("r32")) return "World Cup · Round of 32";
  if (id.startsWith("r16")) return "World Cup · Round of 16";
  if (id.startsWith("qf")) return "World Cup · Quarter-final";
  if (id.startsWith("sf")) return "World Cup · Semi-final";
  return "World Cup · Final";
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(iso));
}

function lastName(name: string | null) {
  const parts = (name ?? "TBD").trim().split(/\s+/);
  return parts.at(-1) ?? "TBD";
}
