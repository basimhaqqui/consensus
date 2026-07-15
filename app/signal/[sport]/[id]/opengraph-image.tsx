import { notFound } from "next/navigation";
import { getShareSignal } from "@/lib/shareSignals";
import { SIGNAL_OG_SIZE, signalSocialImage } from "@/lib/signalOg";

export const alt = "A CONSENSUS daily sports signal";
export const size = SIGNAL_OG_SIZE;
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ sport: string; id: string }>;
}) {
  const { sport, id } = await params;
  const signal = await getShareSignal(sport, id);
  if (!signal) notFound();
  return signalSocialImage(signal);
}
