import { describe, expect, it } from "vitest";

import { labelLines, labelSize, MAX_LINE, PRIZE_COLORS, segmentMiddle, segmentPath } from "./wheel-geometry";

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
    expect(labelSize(8)).toBe(13);
    expect(labelSize(9)).toBe(11);
  });

  it("has a colour for every slice of the fullest wheel", () => {
    expect(PRIZE_COLORS).toHaveLength(10);
  });
});

describe("labelLines", () => {
  it("keeps a short label on one line", () => {
    expect(labelLines("+10 coins")).toEqual(["+10 coins"]);
  });

  it("splits a longer label into two lines where the longer one is shortest", () => {
    expect(labelLines("+10 monedas extra")).toEqual(["+10 monedas", "extra"]);
    expect(labelLines("Free fries today")).toEqual(["Free fries", "today"]);
    expect(labelLines("A big free meal")).toEqual(["A big", "free meal"]);
    // "Lucky" / "Star badge" and "Lucky Star" / "badge" tie: the first line takes more.
    expect(labelLines("Lucky Star badge")).toEqual(["Lucky Star", "badge"]);
  });

  it("cuts a line still too long for the slice", () => {
    const lines = labelLines("Insignia Estrella de la suerte");
    expect(lines).toEqual(["Insignia Estr…", "de la suerte"]);
    for (const line of labelLines("Supercalifragilisticexpialidocious")) expect(line.length).toBeLessThanOrEqual(MAX_LINE);
  });
});
