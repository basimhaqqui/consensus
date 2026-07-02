import { ImageResponse } from "next/og";
import { getLiveMatches } from "@/lib/live";

// Social share card: scoreline (or fixture) + the consensus advance odds,
// in the site's terminal look. Codes and colours only — no emoji flags,
// Satori's font stack doesn't render them reliably.

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Match odds on CONSENSUS";

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { matches } = await getLiveMatches();
  const m = matches.find((x) => x.id === id);

  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const homePct = m ? m.advance.home : 0.5;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0f0d",
          color: "#e4e4e7",
          padding: "56px 72px",
          fontFamily: "monospace",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Satori has no glyph for "▸" — draw the wordmark triangle in CSS */}
          <div
            style={{
              width: 0,
              height: 0,
              borderTop: "16px solid transparent",
              borderBottom: "16px solid transparent",
              borderLeft: "24px solid #34d399",
            }}
          />
          <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: 4 }}>
            CONSENSUS
          </span>
          <span style={{ fontSize: 24, color: "#71717a", marginLeft: "auto" }}>
            World Cup 2026
          </span>
        </div>

        {m ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 72, fontWeight: 700 }}>
                {m.home.name}
              </span>
              <span
                style={{
                  fontSize: 88,
                  fontWeight: 700,
                  color: "#34d399",
                  padding: "0 32px",
                }}
              >
                {m.score && m.status !== "scheduled"
                  ? `${m.score.home}–${m.score.away}`
                  : "vs"}
              </span>
              <span style={{ fontSize: 72, fontWeight: 700 }}>
                {m.away.name}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  display: "flex",
                  height: 28,
                  borderRadius: 14,
                  overflow: "hidden",
                  background: "#27272a",
                }}
              >
                <div
                  style={{
                    width: `${homePct * 100}%`,
                    background: "#34d399",
                  }}
                />
                <div style={{ flex: 1, background: "#38bdf8" }} />
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 32,
                }}
              >
                <span style={{ color: "#34d399" }}>
                  {m.home.code} {pct(m.advance.home)}
                </span>
                <span style={{ color: "#71717a", fontSize: 24 }}>
                  to advance · incl. ET &amp; pens
                </span>
                <span style={{ color: "#38bdf8" }}>
                  {pct(m.advance.away)} {m.away.code}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 56, fontWeight: 700 }}>
            A football intelligence terminal
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 22,
            color: "#71717a",
          }}
        >
          <span>calibrated model · live book odds · graded ledger</span>
          <span>consensus-football.vercel.app</span>
        </div>
      </div>
    ),
    size
  );
}
