import { describe, expect, it } from "vitest";

import {
  announceState,
  metricUnit,
  monthDate,
  monthlyAwardCost,
  standing,
  type AwardCategory,
  type StoreAwards,
} from "./award-rules";

const person = (name: string, value: number) => ({ id: name, name, initials: name[0]!, role: "crew" as const, value });

const category = (over: Partial<AwardCategory> = {}): AwardCategory => ({
  id: "top",
  name: "Top Earner",
  name_es: null,
  metric: "earned",
  coins: 100,
  leader: null,
  winner: null,
  ...over,
});

const store = (number: string, over: Partial<StoreAwards> = {}): StoreAwards => ({
  store: { id: number, number, name: `Store ${number}` },
  month: "2026-11",
  announced: false,
  announced_at: null,
  announced_by: null,
  categories: [],
  ...over,
});

describe("monthlyAwardCost", () => {
  it("is every category that's on, in every open store, in coins and dollars", () => {
    // The spec's defaults: 100 + 75 + 75 + 50 = 300 a store; 5 stores at $0.10.
    const awards = [
      { coins: 100, active: true },
      { coins: 75, active: true },
      { coins: 75, active: true },
      { coins: 50, active: true },
    ];
    expect(monthlyAwardCost(awards, 5, 0.1)).toEqual({ coins: 1500, usd: 150 });
  });

  it("leaves out categories that are off", () => {
    expect(monthlyAwardCost([{ coins: 100, active: true }, { coins: 75, active: false }], 2, 0.1)).toEqual({
      coins: 200,
      usd: 20,
    });
  });

  it("is nothing with no open store", () => {
    expect(monthlyAwardCost([{ coins: 100, active: true }], 0, 0.1)).toEqual({ coins: 0, usd: 0 });
  });
});

describe("standing", () => {
  it("shows the winner once there is one, else whoever leads", () => {
    expect(standing(category({ leader: person("Ana", 120) }))).toEqual({ person: person("Ana", 120), won: false });
    expect(standing(category({ leader: person("Ana", 130), winner: person("Ben", 120) }))).toEqual({
      person: person("Ben", 120),
      won: true,
    });
  });

  it("is nobody when nobody has scored", () => {
    expect(standing(category())).toBeNull();
  });
});

describe("metricUnit", () => {
  it("reads coins, a jump in coins, or shout-outs", () => {
    expect(metricUnit("earned")).toBe("coins");
    expect(metricUnit("improved")).toBe("jump");
    expect(metricUnit("guest")).toBe("shoutouts");
    expect(metricUnit("peer")).toBe("shoutouts");
  });
});

describe("announceState", () => {
  it("can't announce with no open store", () => {
    expect(announceState([])).toEqual({ kind: "none" });
  });

  it("can announce while any store's month is still to announce", () => {
    expect(announceState([store("1"), store("2", { announced: true, announced_at: "2026-11-10T12:00:00Z" })])).toEqual({
      kind: "open",
      month: "2026-11",
    });
  });

  it("is done once every store is announced, saying the latest when and by whom", () => {
    const state = announceState([
      store("1", { announced: true, announced_at: "2026-11-10T12:00:00Z", announced_by: "Kyle" }),
      store("2", { announced: true, announced_at: "2026-11-12T09:00:00Z", announced_by: "Grant" }),
    ]);
    expect(state).toEqual({ kind: "done", month: "2026-11", at: "2026-11-12T09:00:00Z", by: "Grant" });
  });

  it("is done by the month close too, with nobody to name", () => {
    expect(announceState([store("1", { announced: true })])).toEqual({ kind: "done", month: "2026-11", at: null, by: null });
  });
});

describe("monthDate", () => {
  it("is a day inside the month, whatever the time zone it is shown in", () => {
    expect(monthDate("2026-11")?.toISOString()).toBe("2026-11-15T12:00:00.000Z");
    expect(monthDate("2027-01")?.getUTCMonth()).toBe(0);
  });

  it("is null for anything that isn't a month", () => {
    expect(monthDate("2026-13")).toBeNull();
    expect(monthDate("November")).toBeNull();
  });
});
