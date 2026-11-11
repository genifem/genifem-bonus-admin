/**
 * Contrast helpers (WCAG 2.2 AA, plan NF-11). The token tests use them to prove every pairing
 * the product draws, and a screen can use `readableOn` for a fill it does not know in advance.
 */

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parse(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** White or ink, whichever reads better on `background`. */
export function readableOn(background: string): "#FFFFFF" | "#1E1A2B" {
  return contrastRatio(background, "#FFFFFF") >= contrastRatio(background, "#1E1A2B")
    ? "#FFFFFF"
    : "#1E1A2B";
}

/** Accepts #RGB as well as #RRGGBB: a CSS minifier rewrites #FFFFFF to #fff, so any colour
 *  read back out of the browser can arrive in the short form. */
function parse(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`not a hex colour: ${hex}`);
  const digits = m[1]!;
  const full = digits.length === 3 ? digits.replace(/./g, (d) => d + d) : digits;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
