import { SITE_OG_SIZE, siteSocialImage } from "@/lib/siteOg";

export const alt = "CONSENSUS World Cup 2026 archive";
export const size = SITE_OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return siteSocialImage({
    eyebrow: "Completed tournament archive",
    title: "World Cup 2026",
    accentTitle: "the permanent record.",
    description:
      "Final results, calibrated forecasts, title simulations, best performers, and a public prediction ledger.",
    badge: "Archive complete",
    metrics: [
      { label: "Forecasts", value: "10k simulations" },
      { label: "Players", value: "Performance rankings" },
      { label: "Accountability", value: "Graded ledger" },
    ],
  });
}
