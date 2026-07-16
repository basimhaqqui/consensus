import { ImageResponse } from "next/og";

export const SITE_OG_SIZE = { width: 1200, height: 630 };

type SocialMetric = {
  label: string;
  value: string;
};

export function siteSocialImage({
  eyebrow,
  title,
  accentTitle,
  description,
  badge,
  metrics,
}: {
  eyebrow: string;
  title: string;
  accentTitle: string;
  description: string;
  badge: string;
  metrics: [SocialMetric, SocialMetric, SocialMetric];
}) {
  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "48px 58px 44px",
          background: "#070b10",
          color: "#edf2f5",
          fontFamily: "Arial, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            opacity: 0.34,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -260,
            right: -120,
            width: 760,
            height: 760,
            display: "flex",
            borderRadius: 999,
            background: "#34d399",
            opacity: 0.08,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -260,
            bottom: -460,
            width: 820,
            height: 820,
            display: "flex",
            borderRadius: 999,
            background: "#38bdf8",
            opacity: 0.055,
          }}
        />

        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            alignItems: "center",
            paddingBottom: 22,
            borderBottom: "1px solid rgba(148,163,184,0.2)",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              display: "flex",
              marginRight: 13,
              borderTop: "11px solid transparent",
              borderBottom: "11px solid transparent",
              borderLeft: "17px solid #34d399",
            }}
          />
          <span style={{ fontSize: 26, fontWeight: 720, letterSpacing: 3.4 }}>
            CONSENSUS
          </span>
          <span
            style={{
              marginLeft: 18,
              color: "#64717e",
              fontFamily: "monospace",
              fontSize: 14,
              letterSpacing: 2.1,
            }}
          >
            / INTELLIGENCE DESK
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "7px 11px",
              border: "1px solid rgba(52,211,153,0.35)",
              borderRadius: 6,
              color: "#34d399",
              fontFamily: "monospace",
              fontSize: 13,
              letterSpacing: 1.8,
              textTransform: "uppercase",
            }}
          >
            {badge}
          </span>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flex: 1,
            flexDirection: "column",
            justifyContent: "center",
            padding: "27px 0 25px",
          }}
        >
          <span
            style={{
              color: "#34d399",
              fontFamily: "monospace",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 2.4,
              textTransform: "uppercase",
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              marginTop: 13,
              color: "#f5f7f9",
              fontSize: 67,
              fontWeight: 740,
              letterSpacing: -3.2,
              lineHeight: 0.98,
            }}
          >
            {title}
          </span>
          <span
            style={{
              color: "#34d399",
              fontSize: 67,
              fontWeight: 740,
              letterSpacing: -3.2,
              lineHeight: 1,
            }}
          >
            {accentTitle}
          </span>
          <span
            style={{
              maxWidth: 840,
              marginTop: 20,
              color: "#9ba7b2",
              fontSize: 22,
              lineHeight: 1.35,
            }}
          >
            {description}
          </span>
        </div>

        <div
          style={{
            position: "relative",
            width: "100%",
            display: "flex",
            overflow: "hidden",
            border: "1px solid rgba(148,163,184,0.2)",
            borderRadius: 9,
            background: "rgba(8,13,19,0.86)",
          }}
        >
          {metrics.map((metric, index) => (
            <div
              key={metric.label}
              style={{
                display: "flex",
                flex: 1,
                flexDirection: "column",
                padding: "15px 18px",
                borderLeft: index === 0 ? "none" : "1px solid rgba(148,163,184,0.18)",
              }}
            >
              <span
                style={{
                  color: "#64717e",
                  fontFamily: "monospace",
                  fontSize: 12,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                }}
              >
                {metric.label}
              </span>
              <span style={{ marginTop: 5, color: "#dce3e8", fontSize: 22, fontWeight: 650 }}>
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    SITE_OG_SIZE
  );
}
