import { describe, expect, it } from "vitest";

import { budgetEstimate, formatDollars, parseDollars, parseWhole, RANGES, worstCase } from "./coin-rules";

describe("parseWhole", () => {
  it("reads whole coins, with or without separators", () => {
    expect(parseWhole("50", RANGES.allowance)).toEqual({ ok: true, value: 50 });
    expect(parseWhole(" 4,000 ", RANGES.storeBudget)).toEqual({ ok: true, value: 4000 });
    expect(parseWhole("0", RANGES.allowance)).toEqual({ ok: true, value: 0 });
  });

  it("refuses an empty box, a fraction, a sign or a word", () => {
    expect(parseWhole("", RANGES.allowance)).toEqual({ ok: false, problem: "required" });
    expect(parseWhole("12.5", RANGES.allowance)).toEqual({ ok: false, problem: "whole" });
    expect(parseWhole("-3", RANGES.allowance)).toEqual({ ok: false, problem: "whole" });
    expect(parseWhole("ten", RANGES.allowance)).toEqual({ ok: false, problem: "whole" });
  });

  it("holds the spec's Allowed column", () => {
    expect(parseWhole("0", RANGES.amount)).toEqual({ ok: false, problem: "range" });
    expect(parseWhole("1", RANGES.amount)).toEqual({ ok: true, value: 1 });
    expect(parseWhole("5001", RANGES.amount)).toEqual({ ok: false, problem: "range" });
    expect(parseWhole("0", RANGES.maxRewards)).toEqual({ ok: false, problem: "range" });
    expect(parseWhole("50", RANGES.maxRewards)).toEqual({ ok: true, value: 50 });
    expect(parseWhole("51", RANGES.maxRewards)).toEqual({ ok: false, problem: "range" });
    expect(parseWhole("1000001", RANGES.maxCoins)).toEqual({ ok: false, problem: "range" });
  });
});

describe("parseDollars and formatDollars", () => {
  it("reads dollars and cents from $0.01 to $10", () => {
    expect(parseDollars("0.10", RANGES.coinValue)).toEqual({ ok: true, value: 0.1 });
    expect(parseDollars(".25", RANGES.coinValue)).toEqual({ ok: true, value: 0.25 });
    expect(parseDollars("$1", RANGES.coinValue)).toEqual({ ok: true, value: 1 });
    expect(parseDollars("10", RANGES.coinValue)).toEqual({ ok: true, value: 10 });
    expect(parseDollars("2.", RANGES.coinValue)).toEqual({ ok: true, value: 2 });
  });

  it("refuses nothing, a word, fractions of a cent and anything out of range", () => {
    expect(parseDollars("", RANGES.coinValue)).toEqual({ ok: false, problem: "required" });
    expect(parseDollars("abc", RANGES.coinValue)).toEqual({ ok: false, problem: "whole" });
    expect(parseDollars("0.105", RANGES.coinValue)).toEqual({ ok: false, problem: "cents" });
    expect(parseDollars("0", RANGES.coinValue)).toEqual({ ok: false, problem: "range" });
    expect(parseDollars("10.01", RANGES.coinValue)).toEqual({ ok: false, problem: "range" });
  });

  it("always shows the cents", () => {
    expect(formatDollars(0.1)).toBe("0.10");
    expect(formatDollars(2)).toBe("2.00");
  });
});

describe("worstCase", () => {
  it("is every crew member giving their whole allowance, in coins and dollars", () => {
    expect(worstCase(15, 30, 0.1)).toEqual({ coins: 450, usd: 45 });
    expect(worstCase(15, 50, 0.1)).toEqual({ coins: 750, usd: 75 });
    expect(worstCase(120, 30, 0.07)).toEqual({ coins: 3600, usd: 252 });
  });

  it("is nothing with no crew or no allowance", () => {
    expect(worstCase(0, 30, 0.1)).toEqual({ coins: 0, usd: 0 });
    expect(worstCase(15, 0, 0.1)).toEqual({ coins: 0, usd: 0 });
  });
});

describe("budgetEstimate", () => {
  it("prices the store budget for one store and for all of them", () => {
    expect(budgetEstimate(4000, 0.1, 4)).toEqual({ perStore: 400, total: 1600 });
    expect(budgetEstimate(4000, 0.1, 0)).toEqual({ perStore: 400, total: 0 });
    expect(budgetEstimate(2500, 0.15, 3)).toEqual({ perStore: 375, total: 1125 });
  });
});
