import { describe, expect, it } from "vitest";

import { baseFontSize, fitLabel, lineWidth, PRIZE_COLORS, segmentMiddle, segmentPath } from "./wheel-geometry";

describe("the wheel's segments", () => {
  it("cuts the wheel into equal slices, clockwise from the top", () => {
    // Four prizes: the first runs from 12 o'clock to 3 o'clock.
    expect(segmentPath(0, 4)).toBe("M150 150L150 10A140 140 0 0 1 290 150Z");
    expect(segmentPath(1, 4)).toBe("M150 150L290 150A140 140 0 0 1 150 290Z");
    expect(segmentMiddle(0, 4)).toBe(45);
    expect(segmentMiddle(3, 4)).toBe(315);
  });

  it("points each label at the middle of its slice", () => {
    expect(segmentMiddle(0, 8)).toBe(22.5);
    expect(segmentMiddle(2, 3)).toBe(300);
  });

  it("draws narrower slices' labels smaller", () => {
    expect(baseFontSize(8)).toBe(13);
    expect(baseFontSize(9)).toBe(11);
  });

  it("has a colour for every slice of the fullest wheel", () => {
    expect(PRIZE_COLORS).toHaveLength(10);
  });
});

describe("fitLabel", () => {
  const GLYPH_EM = 0.58; // the estimate the fitting uses
  const fitsAtDepth = (label: string, count: number) => {
    const { lines, fontSize } = fitLabel(label, count);
    return lines.every((line, row) => line.length * GLYPH_EM * fontSize <= lineWidth(102 - row * (fontSize + 3), count, fontSize * 0.75));
  };

  it("keeps a short label on one line at the prototype's size", () => {
    expect(fitLabel("+10 coins", 8)).toEqual({ lines: ["+10 coins"], fontSize: 13 });
  });

  it("wraps and shrinks a long Spanish label until every line fits its segment", () => {
    // Drawn as one 14-character line, this ran into the next segment at 360 px (P5 check).
    const fitted = fitLabel("Insignia Estrella de la suerte", 8);
    expect(fitted.lines.join(" ")).toBe("Insignia Estrella de la suerte"); // nothing cut
    expect(fitted.lines.length).toBeLessThanOrEqual(3);
    expect(fitsAtDepth("Insignia Estrella de la suerte", 8)).toBe(true);
    expect(fitsAtDepth("+10 monedas", 8)).toBe(true);
    expect(fitsAtDepth("+100 monedas", 10)).toBe(true);
  });

  it("never draws below the smallest readable size", () => {
    expect(fitLabel("Supercalifragilisticexpialidocious", 10).fontSize).toBeGreaterThanOrEqual(8);
  });
});
