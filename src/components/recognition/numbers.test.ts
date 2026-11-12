import { describe, expect, it } from "vitest";

import { barFill, checkAmount, coinsToUsd, formatCount, formatUsd, percent } from "./numbers";

describe("percent and barFill", () => {
  it("rounds to a whole percent", () => {
    expect(percent(3, 7)).toBe(43);
    expect(percent(7, 7)).toBe(100);
    expect(percent(1, 3)).toBe(33);
    expect(percent(2, 3)).toBe(67);
  });

  it("is 0 with nothing to divide by, or nothing to count", () => {
    expect(percent(0, 0)).toBe(0);
    expect(percent(5, 0)).toBe(0);
    expect(percent(0, 16)).toBe(0);
    expect(percent(-3, 10)).toBe(0);
    expect(percent(Number.NaN, 10)).toBe(0);
  });

  it("says an overspent budget as it is, but never draws a bar past full", () => {
    expect(percent(4800, 4000)).toBe(120);
    expect(barFill(4800, 4000)).toBe(100);
    expect(barFill(1000, 4000)).toBe(25);
    expect(barFill(10, 0)).toBe(0);
  });
});

describe("coinsToUsd", () => {
  it("prices coins at the coin value, to the cent", () => {
    expect(coinsToUsd(1234, 0.1)).toBe(123.4);
    expect(coinsToUsd(3, 0.1)).toBe(0.3);
    expect(coinsToUsd(0, 0.1)).toBe(0);
    expect(coinsToUsd(7, 0.333)).toBe(2.33);
  });
});

describe("formatUsd and formatCount", () => {
  it("writes whole dollars without cents and the rest with two", () => {
    expect(formatUsd(10, "en")).toBe("$10");
    expect(formatUsd(123.4, "en")).toBe("$123.40");
    expect(formatUsd(0, "en")).toBe("$0");
    expect(formatUsd(0.1, "en")).toBe("$0.10");
    expect(formatUsd(1234567.5, "en")).toBe("$1,234,567.50");
  });

  it("writes Spanish the way US stores read it", () => {
    expect(formatUsd(1234.5, "es")).toBe("$1,234.50");
    expect(formatCount(12345, "es")).toBe("12,345");
    expect(formatCount(12345, "en")).toBe("12,345");
  });

  it("rounds a fraction of a cent rather than showing it", () => {
    expect(formatUsd(0.105, "en")).toBe("$0.11");
    expect(formatUsd(9.999, "en")).toBe("$10");
  });
});

describe("checkAmount", () => {
  const limits = { min: 1, max: 5000, left: 2000 };

  it("takes a whole number in range and within what is left", () => {
    expect(checkAmount("150", limits)).toEqual({ ok: true, coins: 150 });
    expect(checkAmount(" 1 ", limits)).toEqual({ ok: true, coins: 1 });
    expect(checkAmount("2,000", limits)).toEqual({ ok: true, coins: 2000 });
  });

  it("asks for an amount when there is none", () => {
    expect(checkAmount("", limits)).toEqual({ ok: false, problem: "required" });
    expect(checkAmount("   ", limits)).toEqual({ ok: false, problem: "required" });
  });

  it("refuses anything that is not a whole number", () => {
    for (const raw of ["12.5", "-5", "1e3", "abc", "10 coins", "0x10"]) {
      expect(checkAmount(raw, limits), raw).toEqual({ ok: false, problem: "whole" });
    }
  });

  it("keeps to the owner's custom range (1 to 5,000)", () => {
    expect(checkAmount("0", limits)).toEqual({ ok: false, problem: "range" });
    expect(checkAmount("5001", { ...limits, left: 9000 })).toEqual({ ok: false, problem: "range" });
    expect(checkAmount("5000", { ...limits, left: 9000 })).toEqual({ ok: true, coins: 5000 });
  });

  it("turns Send off before the API would refuse a send past the budget", () => {
    expect(checkAmount("2001", limits)).toEqual({ ok: false, problem: "over" });
    expect(checkAmount("50", { ...limits, left: 0 })).toEqual({ ok: false, problem: "over" });
  });
});
