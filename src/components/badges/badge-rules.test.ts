import { describe, expect, it } from "vitest";

import { BADGE_RANGES, peopleWith, ruleHasCount, tierProblem } from "./badge-rules";

/** The spec's defaults: Bronze 0, Silver 250, Gold 600, Platinum 1,200. */
const MINS = [0, 250, 600, 1200];

describe("tierProblem", () => {
  it("accepts a threshold between the tiers either side", () => {
    expect(tierProblem(MINS, 1, 300)).toBeNull();
    expect(tierProblem(MINS, 2, 251)).toBeNull();
    expect(tierProblem(MINS, 2, 1199)).toBeNull();
  });

  it("refuses a threshold at or below the tier before it", () => {
    expect(tierProblem(MINS, 1, 0)).toBe("low");
    expect(tierProblem(MINS, 2, 250)).toBe("low");
    expect(tierProblem(MINS, 3, 100)).toBe("low");
  });

  it("refuses a threshold at or above the tier after it", () => {
    expect(tierProblem(MINS, 1, 600)).toBe("high");
    expect(tierProblem(MINS, 2, 5000)).toBe("high");
  });

  it("puts no ceiling on the top tier but the range", () => {
    expect(tierProblem(MINS, 3, 1_000_000)).toBeNull();
    expect(BADGE_RANGES.tierMin.max).toBe(1_000_000);
  });

  it("never asks about Bronze, which is fixed at 0", () => {
    expect(tierProblem(MINS, 0, 99)).toBeNull();
    expect(BADGE_RANGES.tierMin.min).toBe(1);
  });

  it("checks against the neighbours as typed, not as first loaded", () => {
    // Gold was raised to 900: Silver can now go to 800.
    expect(tierProblem([0, 250, 900, 1200], 1, 800)).toBeNull();
    expect(tierProblem(MINS, 1, 800)).toBe("high");
  });
});

describe("people counts", () => {
  const counts = [
    { id: "bronze", people: 12 },
    { id: "silver", people: 3 },
  ];

  it("reads a tier's or badge's count, 0 when the answer leaves it out", () => {
    expect(peopleWith(counts, "silver")).toBe(3);
    expect(peopleWith(counts, "gold")).toBe(0);
  });

  it("is unknown, not 0, when the counts didn't load", () => {
    expect(peopleWith(null, "silver")).toBeNull();
  });
});

describe("ruleHasCount", () => {
  it("has a count for every rule but the wheel's own badge", () => {
    expect(ruleHasCount("tag")).toBe(true);
    expect(ruleHasCount("given")).toBe(true);
    expect(ruleHasCount("days")).toBe(true);
    expect(ruleHasCount("spin")).toBe(false);
  });
});
