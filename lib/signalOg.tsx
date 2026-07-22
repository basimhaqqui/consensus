import { ImageResponse } from "next/og";
import type { ShareSignal } from "./shareSignals";

export const SIGNAL_OG_SIZE = { width: 1200, height: 630 };

const pct = (value: number) => `${Math.round(value * 100)}%`;

export function signalSocialImage(signal: ShareSignal) {
  const accent = signal.sport === "ufc" ? "#f87171" : "#34d399";
  const secondary = signal.sport === "ufc" ? "#60a5fa" : "#38bdf8";
  const marketGap = signal.marketProbability === undefined
    ? undefined
    : signal.modelProbability - signal.marketProbability;

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
          background: "#080b10",
          color: "#edf2f5",
          padding: "50px 58px 46px",
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
            opacity: 0.32,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: -180,
            left: signal.sport === "ufc" ? -100 : -40,
            width: 560,
            height: 560,
            display: "flex",
            borderRadius: 999,
            background: accent,
            opacity: 0.08,
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -190,
            bottom: -250,
            width: 650,
            height: 650,
            display: "flex",
            borderRadius: 999,
            background: secondary,
            opacity: 0.07,
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            width: "100%",
            paddingBottom: 24,
            borderBottom: "1px solid rgba(148,163,184,0.22)",
          }}
        >
          <div
            style={{
              width: 0,
              height: 0,
              display: "flex",
              borderTop: "11px solid transparent",
              borderBottom: "11px solid transparent",
              borderLeft: `17px solid ${accent}`,
              marginRight: 13,
            }}
          />
          <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: 3.4 }}>
            CONSENSUS
          </span>
          <span
            style={{
              marginLeft: 18,
              color: "#5f6b78",
              fontFamily: "monospace",
              fontSize: 15,
              letterSpacing: 2.1,
            }}
          >
            / DAILY SIGNAL
          </span>
          <span
            style={{
              marginLeft: "auto",
              padding: "7px 11px",
              border: `1px solid ${accent}55`,
              borderRadius: 6,
              color: accent,
              fontFamily: "monospace",
              fontSize: 14,
              letterSpacing: 1.8,
              textTransform: "uppercase",
            }}
          >
            {signal.sport}
          </span>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flex: 1,
            paddingTop: 31,
          }}
        >
          <div
            style={{
              display: "flex",
              flex: 1,
              flexDirection: "column",
              paddingRight: 44,
            }}
          >
            <span
              style={{
                color: "#64717e",
                fontFamily: "monospace",
                fontSize: 15,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              {signal.methodLabel} call · {signal.event}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "flex-end",
                marginTop: 14,
              }}
            >
              <span
                style={{
                  maxWidth: 670,
                  color: "#f4f7f9",
                  fontSize: signal.pickName.length > 18 ? 57 : 68,
                  fontWeight: 720,
                  letterSpacing: -2.8,
                  lineHeight: 1,
                }}
              >
                {signal.pickName}
              </span>
              <span
                style={{
                  marginLeft: "auto",
                  color: accent,
                  fontSize: 74,
                  fontWeight: 730,
                  letterSpacing: -3,
                  lineHeight: 0.94,
                }}
              >
                {pct(signal.probability)}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                marginTop: 18,
                color: "#9aa5af",
                fontSize: 25,
              }}
            >
              <span style={{ color: "#d1d8de", fontWeight: 600 }}>
                {signal.left.name}
              </span>
              <span
                style={{
                  margin: "0 17px",
                  color: "#47515d",
                  fontFamily: "monospace",
                  fontSize: 17,
                }}
              >
                VS
              </span>
              <span style={{ color: "#d1d8de", fontWeight: 600 }}>
                {signal.right.name}
              </span>
            </div>
            <div
              style={{
                display: "flex",
                width: "100%",
                height: 8,
                marginTop: 18,
                overflow: "hidden",
                borderRadius: 99,
                background: `${secondary}55`,
              }}
            >
              <div
                style={{
                  width: `${signal.probability * 100}%`,
                  height: "100%",
                  display: "flex",
                  background: accent,
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 23,
                padding: "17px 20px",
                border: "1px solid rgba(148,163,184,0.18)",
                borderRadius: 8,
                background: "rgba(14,19,27,0.88)",
                color: "#aab4bd",
                fontSize: 20,
                lineHeight: 1.35,
              }}
            >
              <span style={{ marginRight: 13, color: accent }}>01</span>
              <span>{signal.reason}</span>
            </div>
          </div>

          <div
            style={{
              width: 285,
              display: "flex",
              flexDirection: "column",
              alignSelf: "stretch",
              padding: "22px 22px 18px",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: 10,
              background: "rgba(10,14,20,0.92)",
            }}
          >
            <span
              style={{
                color: "#596572",
                fontFamily: "monospace",
                fontSize: 13,
                letterSpacing: 1.8,
                textTransform: "uppercase",
              }}
            >
              Signal context
            </span>
            <Metric label="Independent model" value={pct(signal.modelProbability)} accent={accent} />
            <Metric
              label="Sportsbooks"
              value={signal.marketProbability === undefined ? "No line" : pct(signal.marketProbability)}
              accent="#f59e0b"
            />
            {marketGap !== undefined && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  marginTop: "auto",
                  paddingTop: 17,
                  borderTop: "1px solid rgba(148,163,184,0.16)",
                }}
              >
                <span
                  style={{
                    color: "#626e79",
                    fontFamily: "monospace",
                    fontSize: 12,
                    letterSpacing: 1.4,
                    textTransform: "uppercase",
                  }}
                >
                  Model / market gap
                </span>
                <span style={{ marginTop: 7, color: "#e5e9ec", fontSize: 28, fontWeight: 700 }}>
                  {Math.abs(Math.round(marketGap * 100))} points
                </span>
              </div>
            )}
          </div>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 21,
            borderTop: "1px solid rgba(148,163,184,0.17)",
            color: "#5d6874",
            fontFamily: "monospace",
            fontSize: 14,
            letterSpacing: 1.3,
          }}
        >
          <span>{signal.date} · {signal.meta}</span>
          <span style={{ color: "#8d98a3" }}>consensus-football.vercel.app/signals</span>
        </div>
      </div>
    ),
    SIGNAL_OG_SIZE
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        marginTop: 27,
      }}
    >
      <span
        style={{
          color: "#65717d",
          fontFamily: "monospace",
          fontSize: 12,
          letterSpacing: 1.4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ marginTop: 6, color: accent, fontSize: 33, fontWeight: 700 }}>
        {value}
      </span>
    </div>
  );
}
