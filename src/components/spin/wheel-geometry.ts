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

/** The longest line a segment's label is drawn in before it is cut with an ellipsis. */
export const MAX_LINE = 14;

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

/** The label's size: smaller once the segments are narrow. */
export function labelSize(count: number): number {
  return count > 8 ? 11 : 13;
}

const cut = (line: string) => (line.length > MAX_LINE ? `${line.slice(0, MAX_LINE - 1).trimEnd()}…` : line);

/**
 * A label as the segment draws it: one line when it is short (the prototype's 11 characters),
 * otherwise its words in two lines split where the longer line is shortest (the first line
 * when that ties), and any line still too long for the segment cut with an ellipsis.
 */
export function labelLines(label: string): string[] {
  const text = label.trim().replace(/\s+/g, " ");
  if (text.length <= 11) return [text];
  const words = text.split(" ");
  if (words.length < 2) return [cut(text)];
  let best: [string, string] = [text, ""];
  for (let at = 1; at < words.length; at++) {
    const lines: [string, string] = [words.slice(0, at).join(" "), words.slice(at).join(" ")];
    const longest = Math.max(lines[0].length, lines[1].length);
    if (!best[1] || longest <= Math.max(best[0].length, best[1].length)) best = lines;
  }
  return best.map(cut);
}
