// Shared open-graph card renderer: a 1200x630 fight poster for the main event of a card.
// Satori constraints: flex layout only, no clip-path (rounded squares instead of octagons),
// no ▸ glyph; headshots are fetched here and inlined as data URIs so a 404 can't break render.

import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { splitName } from "@/components/ufc/FaceOff";
import { consensusPA, getBookLine, VALUE_GAP, type CardForecast, type FightForecast, type FighterRef } from "@/lib/ufc/data";

export const OG_SIZE = { width: 1200, height: 630 };

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

async function headshotDataUri(id: string | null): Promise<string | null> {
  if (!id) return null;
  try {
    const res = await fetch(`https://a.espncdn.com/i/headshots/mma/players/full/${id}.png`);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

function Face({ src, name, tone }: { src: string | null; name: string | null; tone: string }) {
  const initials = (name ?? "?")
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        width: 210,
        height: 210,
        borderRadius: 24,
        border: `4px solid ${tone}`,
        background: "#14141b",
        overflow: "hidden",
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} width={210} height={210} style={{ objectFit: "cover", objectPosition: "top" }} alt="" />
      ) : (
        <div
          style={{
            display: "flex",
            width: "100%",
            height: "100%",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 84,
            color: "#8b8797",
          }}
        >
          {initials}
        </div>
      )}
    </div>
  );
}

function Corner({
  fighter,
  src,
  p,
  tone,
  align,
}: {
  fighter: FighterRef;
  src: string | null;
  p: number;
  tone: string;
  align: "flex-start" | "flex-end";
}) {
  const { first, last } = splitName(fighter.name);
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: align, gap: 10, width: 400 }}>
      <Face src={src} name={fighter.name} tone={tone} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: align }}>
        <div style={{ fontSize: 26, color: "#8b8797", textTransform: "uppercase" }}>{first || " "}</div>
        <div style={{ fontSize: 58, lineHeight: 1, textTransform: "uppercase", color: "#eceaf0" }}>{last}</div>
      </div>
      <div style={{ display: "flex", fontSize: 44, color: tone }}>{pct(p)}</div>
    </div>
  );
}

export async function fightPoster(card: CardForecast, fight: FightForecast) {
  const [srcA, srcB, font] = await Promise.all([
    headshotDataUri(fight.a.id),
    headshotDataUri(fight.b.id),
    readFile(join(process.cwd(), "assets/ufc/BarlowCondensed-Bold.ttf")),
  ]);
  const book = getBookLine(fight.boutId);
  const { p: pA } = consensusPA(fight);
  const gap = book ? fight.pA - book.pA : 0;
  const value = book && Math.abs(gap) >= VALUE_GAP ? (gap > 0 ? fight.a.name : fight.b.name) : null;
  const red = "#d20a0a";
  const blue = "#2172e5";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#08080b",
          backgroundImage: "radial-gradient(700px 400px at 80% -10%, #1c0b0b 0%, #08080b 60%)",
          padding: "44px 60px",
          fontFamily: "Barlow",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ display: "flex", fontSize: 34, color: "#eceaf0", textTransform: "uppercase" }}>
            {card.name.split(":")[0]}
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#8b8797", textTransform: "uppercase" }}>
            {new Date(card.date).toLocaleDateString("en-US", {
              weekday: "short",
              month: "short",
              day: "numeric",
              timeZone: "UTC",
            })}
            {" · "}
            {fight.weightClass ?? ""}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 26 }}>
          <Corner fighter={fight.a} src={srcA} p={pA} tone={red} align="flex-start" />
          <div style={{ display: "flex", fontSize: 52, color: "#3a3a46", marginTop: 80 }}>VS</div>
          <Corner fighter={fight.b} src={srcB} p={1 - pA} tone={blue} align="flex-end" />
        </div>

        <div style={{ display: "flex", height: 18, borderRadius: 9, overflow: "hidden", marginTop: 26 }}>
          <div style={{ display: "flex", width: `${pA * 100}%`, background: red }} />
          <div style={{ display: "flex", flex: 1, background: blue }} />
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 18 }}>
          <div style={{ display: "flex", fontSize: 24, color: "#8b8797" }}>
            {book ? `model ${pct(fight.pA)} · books ${pct(book.pA)}` : "model forecast"}
            {" — UFC CONSENSUS"}
          </div>
          {value && (
            <div
              style={{
                display: "flex",
                fontSize: 24,
                color: "#f5b40b",
                border: "2px solid #f5b40b",
                borderRadius: 8,
                padding: "4px 14px",
                textTransform: "uppercase",
              }}
            >
              value {splitName(value).last} +{Math.round(Math.abs(gap) * 100)}
            </div>
          )}
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [{ name: "Barlow", data: font, style: "normal", weight: 700 }],
    }
  );
}
