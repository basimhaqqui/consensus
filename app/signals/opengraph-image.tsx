import { SITE_OG_SIZE, siteSocialImage } from "@/lib/siteOg";

export const alt = "CONSENSUS Daily Signals — three clear sports calls";
export const size = SITE_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteSocialImage({
    eyebrow: "Daily decision desk",
    title: "Three signals.",
    accentTitle: "Zero noise.",
    description:
      "The clearest calls across football and UFC, ranked by confidence, importance, and live market context.",
    badge: "Re-ranked live",
    metrics: [
      { label: "Board", value: "3 ranked calls" },
      { label: "Method", value: "Relevance × confidence" },
      { label: "Evidence", value: "Model + market" },
    ],
  });
}
