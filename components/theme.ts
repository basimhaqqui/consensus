// Team-identity card theming, shared by the pitch mini-cards and the player
// popup: both kit/crest colours colour-blocked into the card (country at
// internationals, club in league games) with a glossy light sweep so they
// read like collectible cards, not flat chips.

type RGB = [number, number, number];

function hexToRgb(h?: string): RGB | null {
  const m = (h ?? "").replace("#", "").match(/^[0-9a-f]{6}$/i);
  if (!m) return null;
  const n = parseInt(m[0], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const css = (rgb: RGB) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;

const mix = (a: RGB, b: RGB, t: number): RGB =>
  [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t)) as RGB;

// t > 0 mixes toward white, t < 0 toward black.
const shade = (rgb: RGB, t: number): RGB =>
  mix(rgb, t > 0 ? [255, 255, 255] : [0, 0, 0], Math.abs(t));

const luma = (rgb: RGB) =>
  (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;

const GOLD: RGB = [217, 188, 116]; // fallback: FUT gold
const GOLD_ALT: RGB = [122, 95, 42];

export function cardTheme(color?: string, alt?: string) {
  const rgb = hexToRgb(color) ?? GOLD;
  // Guard against alt ≈ primary (some feeds repeat the colour): fall back to
  // a strong shade of the primary so the colour-blocking stays visible.
  let altRgb = hexToRgb(alt) ?? (hexToRgb(color) ? null : GOLD_ALT);
  if (!altRgb || altRgb.every((v, i) => Math.abs(v - rgb[i]) < 24)) {
    altRgb = shade(rgb, luma(rgb) > 0.5 ? -0.55 : 0.55);
  }
  const light = luma(rgb) > 0.62;
  const bandLight = luma(altRgb) > 0.62;
  return {
    // stacked: gloss sweep → top glow → primary-to-alt colour blocking
    grad: [
      "linear-gradient(115deg, rgba(255,255,255,0.28) 0%, rgba(255,255,255,0.06) 32%, rgba(255,255,255,0) 45%)",
      `radial-gradient(130% 85% at 50% -20%, ${css(shade(rgb, 0.45))} 0%, rgba(0,0,0,0) 58%)`,
      `linear-gradient(160deg, ${css(shade(rgb, 0.12))} 0%, ${css(rgb)} 46%, ${css(
        mix(rgb, altRgb, 0.5)
      )} 76%, ${css(altRgb)} 112%)`,
    ].join(", "),
    ink: light ? "#181b20" : "#ffffff",
    sub: light ? "rgba(24,27,32,0.72)" : "rgba(255,255,255,0.8)",
    bandBg: css(altRgb),
    bandInk: bandLight ? "#181b20" : "#ffffff",
  };
}
