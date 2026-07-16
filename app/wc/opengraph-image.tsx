import { SITE_OG_SIZE, siteSocialImage } from "@/lib/siteOg";

export const alt = "CONSENSUS World Cup 2026 intelligence terminal";
export const size = SITE_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteSocialImage({
    eyebrow: "Tournament command",
    title: "World Cup 2026",
    accentTitle: "intelligence center.",
    description:
      "Live scores, calibrated forecasts, title simulations, best performers, and a public prediction ledger.",
    badge: "Model live",
    metrics: [
      { label: "Forecasts", value: "10k simulations" },
      { label: "Players", value: "Performance rankings" },
      { label: "Accountability", value: "Graded ledger" },
    ],
  });
}
