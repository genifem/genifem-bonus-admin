import { describe, expect, it } from "vitest";

import { contrastRatio, readableOn, relativeLuminance } from "./color";

describe("color", () => {
  it("computes WCAG contrast", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
  });

  it("matches the ratios the plan quotes for the two reds (D17)", () => {
    expect(contrastRatio("#FFFFFF", "#E63946")).toBeCloseTo(4.17, 2);
    expect(contrastRatio("#FFFFFF", "#C92A37")).toBeCloseTo(5.43, 2);
    expect(contrastRatio("#C92A37", "#FFF8F1")).toBeCloseTo(5.16, 2);
  });

  it("picks readable text for a fill", () => {
    expect(readableOn("#C92A37")).toBe("#FFFFFF"); // action red
    expect(readableOn("#F5B700")).toBe("#1E1A2B"); // gold
    expect(readableOn("#5B37B8")).toBe("#FFFFFF"); // lilac ink
  });

  it("rejects malformed colours", () => {
    expect(() => readableOn("red")).toThrow();
    expect(() => readableOn("#ff")).toThrow();
  });

  it("reads the short form a CSS minifier produces", () => {
    expect(contrastRatio("#fff", "#000")).toBeCloseTo(21, 5);
    expect(relativeLuminance("#fff")).toBeCloseTo(relativeLuminance("#FFFFFF"), 10);
    expect(readableOn("#f5b700")).toBe(readableOn("#F5B700"));
  });
});
