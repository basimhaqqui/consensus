import { notFound } from "next/navigation";
import { fightPoster, OG_SIZE } from "@/lib/ufc/og";
import { getCard, type FightForecast } from "@/lib/ufc/data";

export const alt = "Fight forecast";
export const size = OG_SIZE;
export const contentType = "image/png";

export function mainEventOf(fights: FightForecast[]): FightForecast | undefined {
  if (!fights.length) return undefined;
  if (fights.some((f) => f.matchNumber != null)) {
    return [...fights].sort((a, b) => (a.matchNumber ?? 99) - (b.matchNumber ?? 99))[0];
  }
  return fights.at(-1); // ESPN raw order lists prelims first
}

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = getCard(id);
  const main = card && mainEventOf(card.fights);
  if (!card || !main) notFound();
  return fightPoster(card, main);
}
