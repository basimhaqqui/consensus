export type CompetitionMeta = {
  slug: string;
  name: string;
  season: number;
  updatedAt: string;
  matchesPlayed: number;
  playersTracked: number;
  source: string;
};

export type CompetitionPlayerStats = {
  key: string;
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  photo: string;
  nationality: string;
  age: number | null;
  height: string | null;
  teamId: number;
  teamName: string;
  teamLogo: string;
  position: string;
  number: number | null;
  appearances: number;
  starts: number;
  minutes: number;
  rating: number;
  goals: number;
  assists: number;
  goalContributions: number;
  shots: number;
  shotsOnTarget: number;
  keyPasses: number;
  passes: number;
  passAccuracy: number;
  tackles: number;
  interceptions: number;
  blocks: number;
  defensiveActions: number;
  duels: number;
  duelsWon: number;
  dribbles: number;
  dribblesWon: number;
  foulsDrawn: number;
  foulsCommitted: number;
  yellowCards: number;
  redCards: number;
  saves: number;
  conceded: number;
  cleanSheets: number;
  penaltiesSaved: number;
  impact: number;
  roleRank: number;
  overallRank: number;
};

export type LeaderCategory =
  | "impact"
  | "goals"
  | "assists"
  | "contributions"
  | "rating"
  | "chances"
  | "cleanSheets"
  | "ballWins"
  | "shotsOnTarget"
  | "saves";

export type CompetitionPerformanceView = {
  competition: CompetitionMeta;
  categories: Record<LeaderCategory, CompetitionPlayerStats[]>;
  roles: Record<
    "Attacker" | "Midfielder" | "Defender" | "Goalkeeper",
    CompetitionPlayerStats[]
  >;
};
