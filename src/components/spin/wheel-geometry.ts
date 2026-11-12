/**
 * The prize wheel's drawing (OP-16's live preview, the app's CR-28): equal segments in the
 * prize list's order, clockwise from the top where the pointer is, each in the prototype's
 * prize colours, with its label along the middle of the segment. How often a prize comes up is
 * its chance weight, never its size on the wheel. Pure, so it can be tested on its own.
 */

/** The prototype's PRIZE_COLORS: light fills the ink labels read on. Segment i takes colour
 *  i, round again after ten. */
export const PRIZE_COLORS = [
  "#FFD873",
  "#FFFFFF",
  "#FFB4A0",
  "#FFC94D",
  "#CFC6FF",
  "#FBF1E6",
  "#A8E6CC",
  "#FFE4E6",
  "#BFE0FF",
  "#FFE7D6",
] as const;

/** The wheel's own box: a 300 x 300 view, centre 150, segments out to 140. */
export const WHEEL = { size: 300, centre: 150, radius: 140 } as const;

const round = (value: number) => Math.round(value * 100) / 100;

/** The point at `degrees` clockwise from the top, on the rim. */
function rim(degrees: number): [number, number] {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return [round(WHEEL.centre + WHEEL.radius * Math.cos(radians)), round(WHEEL.centre + WHEEL.radius * Math.sin(radians))];
}

/** Segment `index` of `count`, as an SVG path: from the centre to the rim and round. */
export function segmentPath(index: number, count: number): string {
  const n = Math.max(1, count);
  const sweep = 360 / n;
  const [x1, y1] = rim(index * sweep);
  const [x2, y2] = rim((index + 1) * sweep);
  const large = sweep > 180 ? 1 : 0;
  const c = WHEEL.centre;
  return `M${c} ${c}L${x1} ${y1}A${WHEEL.radius} ${WHEEL.radius} 0 ${large} 1 ${x2} ${y2}Z`;
}

/** Where segment `index`'s label points: the middle of the segment, in degrees from the top. */
export function segmentMiddle(index: number, count: number): number {
  const sweep = 360 / Math.max(1, count);
  return round(index * sweep + sweep / 2);
}

/* ---------------------------------------------------------------- labels */
// The same fitting as the app's wheel (bonus-app src/lib/wheel.ts, fitLabel), so the preview
// shows each label as crew will see it: a long one (owner-typed names run to 40 characters,
// and Spanish runs long: "Insignia Estrella de la suerte") wraps and shrinks until every
// line fits across its segment at its own depth, instead of running into the next segment.

/** The first line's baseline, measured in from the centre (y = 48 in the prototype). */
const FIRST_LINE = WHEEL.centre - 48;
const LINE_GAP = 3;
/** Nunito Black's average glyph, as a share of the font size: a fair estimate, not a measure. */
const GLYPH_EM = 0.58;
/** Room kept clear at each side of a line, inside the segment's edges. */
const SIDE_PAD = 4;
const MAX_LINES = 3;
const MIN_FONT = 8;
/** How far glyphs rise above their baseline, as a share of the font size. */
const ASCENT_EM = 0.75;

/** The prototype's sizes: 13, or 11 on a crowded wheel. */
export function baseFontSize(count: number): number {
  return count > 8 ? 11 : 13;
}

/**
 * How wide a line with its baseline at `distance` from the centre can be: the segment's width
 * at the baseline (where the wedge is narrowest), and never past the rim at the glyphs' tops
 * (`ascent` above it, where the circle is narrowest).
 */
export function lineWidth(distance: number, count: number, ascent = 0): number {
  const half = (360 / Math.max(1, count) / 2) * (Math.PI / 180);
  const wedge = half >= Math.PI / 2 ? Number.POSITIVE_INFINITY : 2 * distance * Math.tan(half);
  const top = Math.min(WHEEL.radius, distance + ascent);
  const rim = 2 * Math.sqrt(Math.max(0, WHEEL.radius * WHEEL.radius - top * top));
  return Math.max(0, Math.min(wedge, rim) - 2 * SIDE_PAD);
}

/** Words into lines of at most `maxChars`; a word longer than that keeps a line to itself. */
export function wrapWords(label: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const word of label.trim().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

/** Where line `line` of a label sits, as the y of its baseline in the 300 box (before the
 *  segment's rotation): the first at 48, then down toward the hub. */
export function lineY(line: number, fontSize: number): number {
  return WHEEL.centre - FIRST_LINE + line * (fontSize + LINE_GAP);
}

export interface FittedLabel {
  lines: string[];
  fontSize: number;
}

function fits(lines: string[], size: number, count: number): boolean {
  return lines.every(
    (line, index) =>
      line.length * GLYPH_EM * size <= lineWidth(FIRST_LINE - index * (size + LINE_GAP), count, size * ASCENT_EM),
  );
}

/** A prize's label laid out for its segment: wrapped to what fits across it near the rim (at
 *  most three lines), at the prototype's size or smaller until every line fits at its depth. */
export function fitLabel(label: string, count: number): FittedLabel {
  const base = baseFontSize(count);
  let maxChars = Math.max(4, Math.floor(lineWidth(FIRST_LINE, count, base * ASCENT_EM) / (GLYPH_EM * base)));
  let lines = wrapWords(label, maxChars);
  while (lines.length > MAX_LINES) {
    maxChars += 1;
    lines = wrapWords(label, maxChars);
  }
  for (let size = base; size > MIN_FONT; size--) {
    if (fits(lines, size, count)) return { lines, fontSize: size };
  }
  return { lines, fontSize: MIN_FONT };
}
