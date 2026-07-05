// ---------------------------------------------------------------------------
// Real 2026 World Cup Round-of-32 data (as of 29 June 2026).
//
// Team ratings are Elo-style strength estimates calibrated to the live market
// title-odds and current form. `titleOdds` is the American moneyline to win
// the whole tournament where a market price exists (top contenders only).
// ---------------------------------------------------------------------------

import { DERIVED_RATINGS, TEAM_STYLE } from "./derivedRatings";

// Attack/concede style residuals for the goals model (see compute-ratings).
export function teamStyle(key: string) {
  return TEAM_STYLE[key];
}

export type Team = {
  name: string;
  code: string; // short label
  flag: string; // emoji
  rating: number; // our model's rating (data-derived Elo)
  marketRating?: number; // market-implied rating (calibrated to title odds)
  titleOdds?: string; // American odds to win the tournament, if a contender
};

export const TEAMS: Record<string, Team> = {
  FRA: { name: "France", code: "FRA", flag: "🇫🇷", rating: 2090, titleOdds: "+340" },
  ARG: { name: "Argentina", code: "ARG", flag: "🇦🇷", rating: 2075, titleOdds: "+420" },
  ESP: { name: "Spain", code: "ESP", flag: "🇪🇸", rating: 2055, titleOdds: "+700" },
  ENG: { name: "England", code: "ENG", flag: "🏴󠁧󠁢󠁥󠁮󠁧󠁿", rating: 2035, titleOdds: "+700" },
  BRA: { name: "Brazil", code: "BRA", flag: "🇧🇷", rating: 2015, titleOdds: "+1200" },
  POR: { name: "Portugal", code: "POR", flag: "🇵🇹", rating: 2005, titleOdds: "+1300" },
  GER: { name: "Germany", code: "GER", flag: "🇩🇪", rating: 2000, titleOdds: "+1400" },
  NED: { name: "Netherlands", code: "NED", flag: "🇳🇱", rating: 1985, titleOdds: "+1500" },
  BEL: { name: "Belgium", code: "BEL", flag: "🇧🇪", rating: 1955, titleOdds: "+2500" },
  CRO: { name: "Croatia", code: "CRO", flag: "🇭🇷", rating: 1915, titleOdds: "+4000" },
  MAR: { name: "Morocco", code: "MAR", flag: "🇲🇦", rating: 1910, titleOdds: "+4000" },
  COL: { name: "Colombia", code: "COL", flag: "🇨🇴", rating: 1900, titleOdds: "+5000" },
  NOR: { name: "Norway", code: "NOR", flag: "🇳🇴", rating: 1895, titleOdds: "+5000" },
  SEN: { name: "Senegal", code: "SEN", flag: "🇸🇳", rating: 1880, titleOdds: "+6600" },
  SUI: { name: "Switzerland", code: "SUI", flag: "🇨🇭", rating: 1875, titleOdds: "+8000" },
  JPN: { name: "Japan", code: "JPN", flag: "🇯🇵", rating: 1865, titleOdds: "+8000" },
  MEX: { name: "Mexico", code: "MEX", flag: "🇲🇽", rating: 1840, titleOdds: "+6600" },
  USA: { name: "USA", code: "USA", flag: "🇺🇸", rating: 1835, titleOdds: "+3000" },
  ECU: { name: "Ecuador", code: "ECU", flag: "🇪🇨", rating: 1830, titleOdds: "+10000" },
  SWE: { name: "Sweden", code: "SWE", flag: "🇸🇪", rating: 1825, titleOdds: "+12500" },
  AUT: { name: "Austria", code: "AUT", flag: "🇦🇹", rating: 1820, titleOdds: "+15000" },
  IVO: { name: "Ivory Coast", code: "CIV", flag: "🇨🇮", rating: 1810, titleOdds: "+15000" },
  CAN: { name: "Canada", code: "CAN", flag: "🇨🇦", rating: 1805, titleOdds: "+10000" },
  ALG: { name: "Algeria", code: "ALG", flag: "🇩🇿", rating: 1800, titleOdds: "+20000" },
  GHA: { name: "Ghana", code: "GHA", flag: "🇬🇭", rating: 1795, titleOdds: "+25000" },
  EGY: { name: "Egypt", code: "EGY", flag: "🇪🇬", rating: 1790, titleOdds: "+25000" },
  AUS: { name: "Australia", code: "AUS", flag: "🇦🇺", rating: 1790, titleOdds: "+25000" },
  BIH: { name: "Bosnia & Herz.", code: "BIH", flag: "🇧🇦", rating: 1785, titleOdds: "+30000" },
  COD: { name: "DR Congo", code: "COD", flag: "🇨🇩", rating: 1775, titleOdds: "+40000" },
  PAR: { name: "Paraguay", code: "PAR", flag: "🇵🇾", rating: 1770, titleOdds: "+40000" },
  RSA: { name: "South Africa", code: "RSA", flag: "🇿🇦", rating: 1760, titleOdds: "+50000" },
  CPV: { name: "Cape Verde", code: "CPV", flag: "🇨🇻", rating: 1720, titleOdds: "+75000" },
};

// Overlay our data-derived Elo as the model rating; keep the original
// market-calibrated value as marketRating (for the Model/Market toggle).
// The hand-set market gaps were tuned to the original /90 link, so stretch
// them about a 1900 anchor onto the /300 scale — same implied supremacy.
for (const [key, t] of Object.entries(TEAMS)) {
  t.marketRating = Math.round(1900 + (t.rating - 1900) * (300 / 90));
  if (DERIVED_RATINGS[key] !== undefined) t.rating = DERIVED_RATINGS[key];
}

export type Fixture = {
  id: string;
  date: string; // display
  kickoffISO: string; // for sorting
  venue: string;
  home: string; // team key
  away: string; // team key
  homeAdv?: number; // net Elo bump on the home side (host playing in own country)
  status: "scheduled" | "final";
  score?: { home: number; away: number };
};

// Co-host crowd edge, in Elo points (roughly two-thirds of the fitted
// 100-Elo standard home advantage). Applied venue-aware: full bump only in
// the team's own country, half in simulations where the venue isn't known.
export const HOST_ADV: Record<string, number> = { MEX: 65, USA: 60, CAN: 55 };

const MEX_CITIES = /mexico city|guadalajara|monterrey/i;
const CAN_CITIES = /toronto|vancouver/i;

// Net home-side Elo bump for a knockout tie at a known venue.
export function venueHostAdv(home: string, away: string, venue: string): number {
  const country = MEX_CITIES.test(venue)
    ? "MEX"
    : CAN_CITIES.test(venue)
    ? "CAN"
    : "USA";
  let adv = 0;
  if (home === country) adv += HOST_ADV[home] ?? 0;
  if (away === country) adv -= HOST_ADV[away] ?? 0;
  return adv;
}

// Round of 32 — full 16-match bracket. Two already decided.
export const FIXTURES: Fixture[] = [
  {
    id: "r32-01", date: "Sun Jun 28", kickoffISO: "2026-06-28T20:00:00Z",
    venue: "Los Angeles", home: "RSA", away: "CAN", status: "final", score: { home: 0, away: 1 },
  },
  {
    id: "r32-02", date: "Mon Jun 29", kickoffISO: "2026-06-29T17:00:00Z",
    venue: "Houston", home: "BRA", away: "JPN", status: "final", score: { home: 2, away: 1 },
  },
  {
    id: "r32-03", date: "Mon Jun 29", kickoffISO: "2026-06-29T20:30:00Z",
    venue: "Boston", home: "GER", away: "PAR", status: "scheduled",
  },
  {
    id: "r32-04", date: "Mon Jun 29", kickoffISO: "2026-06-29T23:00:00Z",
    venue: "Monterrey", home: "NED", away: "MAR", status: "scheduled",
  },
  {
    id: "r32-05", date: "Tue Jun 30", kickoffISO: "2026-06-30T19:00:00Z",
    venue: "Dallas", home: "IVO", away: "NOR", status: "scheduled",
  },
  {
    id: "r32-06", date: "Tue Jun 30", kickoffISO: "2026-06-30T21:00:00Z",
    venue: "New York / NJ", home: "FRA", away: "SWE", status: "scheduled",
  },
  {
    id: "r32-07", date: "Tue Jun 30", kickoffISO: "2026-06-30T23:30:00Z",
    venue: "Mexico City", home: "MEX", away: "ECU", homeAdv: 65, status: "scheduled",
  },
  {
    id: "r32-08", date: "Wed Jul 1", kickoffISO: "2026-07-01T18:00:00Z",
    venue: "Atlanta", home: "ENG", away: "COD", status: "scheduled",
  },
  {
    id: "r32-09", date: "Wed Jul 1", kickoffISO: "2026-07-01T21:00:00Z",
    venue: "Seattle", home: "BEL", away: "SEN", status: "scheduled",
  },
  {
    id: "r32-10", date: "Wed Jul 1", kickoffISO: "2026-07-01T23:30:00Z",
    venue: "San Francisco Bay", home: "USA", away: "BIH", homeAdv: 60, status: "scheduled",
  },
  {
    id: "r32-11", date: "Thu Jul 2", kickoffISO: "2026-07-02T19:00:00Z",
    venue: "Los Angeles", home: "ESP", away: "AUT", status: "scheduled",
  },
  {
    id: "r32-12", date: "Thu Jul 2", kickoffISO: "2026-07-02T21:00:00Z",
    venue: "Toronto", home: "POR", away: "CRO", status: "scheduled",
  },
  {
    id: "r32-13", date: "Thu Jul 2", kickoffISO: "2026-07-02T23:30:00Z",
    venue: "Vancouver", home: "SUI", away: "ALG", status: "scheduled",
  },
  {
    id: "r32-14", date: "Fri Jul 3", kickoffISO: "2026-07-03T19:00:00Z",
    venue: "Dallas", home: "AUS", away: "EGY", status: "scheduled",
  },
  {
    id: "r32-15", date: "Fri Jul 3", kickoffISO: "2026-07-03T21:30:00Z",
    venue: "Miami", home: "ARG", away: "CPV", status: "scheduled",
  },
  {
    id: "r32-16", date: "Fri Jul 3", kickoffISO: "2026-07-03T23:30:00Z",
    venue: "Kansas City", home: "COL", away: "GHA", status: "scheduled",
  },
];

export const LAST_UPDATED = "29 Jun 2026, Round of 32";

// Which rating powers the forecast: our data-derived Elo, the market, or the
// consensus blend (50/50 — the market prices information our Elo can't see,
// injuries and squad news; our Elo is immune to public sentiment biases).
export type RatingSource = "blend" | "model" | "market";
export function teamRating(key: string, source: RatingSource = "model"): number {
  const t = TEAMS[key];
  if (!t) return 1700;
  const market = t.marketRating ?? t.rating;
  if (source === "market") return market;
  if (source === "blend") return Math.round((t.rating + market) / 2);
  return t.rating;
}

// ESPN country-crest URL for a team key (a couple of codes differ from ours).
const CREST_OVERRIDE: Record<string, string> = { IVO: "civ", COD: "rdc" };
export function crestUrl(key: string): string {
  const code = CREST_OVERRIDE[key] ?? key.toLowerCase();
  return `https://a.espncdn.com/i/teamlogos/countries/500/${code}.png`;
}

// Our fixture id -> ESPN event id, for fetching match detail (lineups etc).
export const ESPN_EVENT_ID: Record<string, string> = {
  "r32-01": "760486",
  "r32-02": "760487",
  "r32-03": "760489",
  "r32-04": "760488",
  "r32-05": "760490",
  "r32-06": "760492",
  "r32-07": "760491",
  "r32-08": "760495",
  "r32-09": "760493",
  "r32-10": "760494",
  "r32-11": "760497",
  "r32-12": "760496",
  "r32-13": "760498",
  "r32-14": "760499",
  "r32-15": "760500",
  "r32-16": "760501",
};
