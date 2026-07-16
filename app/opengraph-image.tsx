import { SITE_OG_SIZE, siteSocialImage } from "@/lib/siteOg";

export const alt = "CONSENSUS — sports intelligence for football and UFC";
export const size = SITE_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteSocialImage({
    eyebrow: "Sports intelligence, distilled",
    title: "See the match",
    accentTitle: "before it unfolds.",
    description:
      "Live scores, transparent forecasts, market context, and public results across football and UFC.",
    badge: "Feed online",
    metrics: [
      { label: "Coverage", value: "Football + UFC" },
      { label: "Forecasting", value: "Model + market" },
      { label: "Track record", value: "Public ledgers" },
    ],
  });
}
