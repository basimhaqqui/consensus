import { fightPoster, OG_SIZE } from "@/lib/ufc/og";
import { getCards } from "@/lib/ufc/data";
import { mainEventOf } from "@/app/ufc/event/[id]/opengraph-image";

export const alt = "UFC Consensus — fight forecasts";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  const next = getCards()[0];
  const main = next && mainEventOf(next.fights);
  if (!next || !main) throw new Error("no upcoming card");
  return fightPoster(next, main);
}
