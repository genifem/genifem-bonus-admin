import { describe, expect, it } from "vitest";

import {
  averagePerSpin,
  canAdd,
  canRemove,
  DEFAULT_AMOUNT,
  hasItems,
  kindChanges,
  MAX_PRIZES,
  MIN_PRIZES,
  NEW_PRIZE,
  newPrizeId,
  odds,
  prizeLabel,
  samePrizeIds,
  totalWeight,
  wheelBadge,
  withKind,
  withPrizeAdded,
  withPrizeRemoved,
  type Prize,
} from "./spin-rules";

const prize = (id: string, kind: Prize["kind"], amount: number, weight: number): Prize => ({
  id,
  label: id,
  label_es: null,
  kind,
  amount,
  weight,
  badge_id: kind === "badge" ? "lucky" : null,
});

/** The spec's default wheel: +10 (30), +25 (22), drink (15), +50 (12), fries (12), +100 (5),
 *  +10 kudos (3), Lucky Star (1). */
const DEFAULTS: Prize[] = [
  prize("p1", "coins", 10, 30),
  prize("p2", "coins", 25, 22),
  prize("p3", "item", 0, 15),
  prize("p4", "coins", 50, 12),
  prize("p5", "item", 0, 12),
  prize("p6", "coins", 100, 5),
  prize("p7", "kudos", 10, 3),
  prize("p8", "badge", 0, 1),
];

const many = (count: number) => Array.from({ length: count }, (_, i) => prize(`p${i + 1}`, "coins", 10, 1));

describe("odds", () => {
  it("is each weight over all of them, in percent to one decimal", () => {
    expect(totalWeight(DEFAULTS)).toBe(100);
    expect(odds(DEFAULTS)).toEqual([30, 22, 15, 12, 12, 5, 3, 1]);
    expect(odds([prize("a", "coins", 1, 1), prize("b", "coins", 1, 2)])).toEqual([33.3, 66.7]);
  });

  it("gives a weight of 0 no chance, and nothing a chance when every weight is 0", () => {
    expect(odds([prize("a", "coins", 1, 0), prize("b", "coins", 1, 5)])).toEqual([0, 100]);
    expect(odds([prize("a", "coins", 1, 0), prize("b", "coins", 1, 0)])).toEqual([0, 0]);
  });

  it("never lets a negative weight count", () => {
    expect(odds([prize("a", "coins", 1, -5), prize("b", "coins", 1, 5)])).toEqual([0, 100]);
  });
});

describe("averagePerSpin", () => {
  it("counts coin prizes by their chance, in coins and dollars", () => {
    // (10*30 + 25*22 + 50*12 + 100*5) / 100 = 19.5 coins; at $0.10, $1.95.
    expect(averagePerSpin(DEFAULTS, 0.1)).toEqual({ coins: 19.5, usd: 1.95 });
  });

  it("leaves out extra kudos, free items and the badge", () => {
    const wheel = [prize("k", "kudos", 50, 1), prize("i", "item", 0, 1), prize("b", "badge", 0, 1), prize("c", "coins", 30, 1)];
    expect(averagePerSpin(wheel, 0.1)).toEqual({ coins: 7.5, usd: 0.75 });
  });

  it("rounds to one decimal of a coin and to the cent", () => {
    // (10*1 + 25*2) / 3 = 20 coins; at $0.07, $1.40.
    expect(averagePerSpin([prize("a", "coins", 10, 1), prize("b", "coins", 25, 2)], 0.07)).toEqual({
      coins: 20,
      usd: 1.4,
    });
    // 1 coin a third of the time: 0.333... coins, $0.33 at $1.
    expect(averagePerSpin([prize("a", "coins", 1, 1), prize("b", "item", 0, 2)], 1)).toEqual({ coins: 0.3, usd: 0.33 });
  });

  it("is nothing when no prize has a chance", () => {
    expect(averagePerSpin([prize("a", "coins", 10, 0), prize("b", "coins", 20, 0)], 0.1)).toEqual({ coins: 0, usd: 0 });
  });

  it("knows whether free items can come up", () => {
    expect(hasItems(DEFAULTS)).toBe(true);
    expect(hasItems([prize("a", "coins", 10, 1), prize("i", "item", 0, 0)])).toBe(false);
  });
});

describe("adding and removing prizes", () => {
  it("allows 3 to 10 prizes", () => {
    expect(MIN_PRIZES).toBe(3);
    expect(MAX_PRIZES).toBe(10);
    expect(canAdd(9)).toBe(true);
    expect(canAdd(10)).toBe(false);
    expect(canRemove(4)).toBe(true);
    expect(canRemove(3)).toBe(false);
  });

  it("adds the prototype's new prize at the end, under the id it is given", () => {
    const next = withPrizeAdded(DEFAULTS, "pnew01");
    expect(next).toHaveLength(9);
    expect(next?.slice(0, 8)).toEqual(DEFAULTS);
    expect(next?.[8]).toEqual({ id: "pnew01", ...NEW_PRIZE });
    expect(NEW_PRIZE).toMatchObject({ label: "+20 coins", kind: "coins", amount: 20, weight: 5 });
  });

  it("won't add an eleventh prize or reuse an id", () => {
    expect(withPrizeAdded(many(10), "pnew01")).toBeNull();
    expect(withPrizeAdded(DEFAULTS, "p3")).toBeNull();
  });

  it("removes one prize and keeps the rest in order", () => {
    expect(withPrizeRemoved(DEFAULTS, "p3")?.map((item) => item.id)).toEqual(["p1", "p2", "p4", "p5", "p6", "p7", "p8"]);
  });

  it("won't go below 3 prizes or remove one that isn't there", () => {
    expect(withPrizeRemoved(many(3), "p1")).toBeNull();
    expect(withPrizeRemoved(DEFAULTS, "nope")).toBeNull();
  });

  it("makes new ids the API accepts, never one already taken", () => {
    const id = newPrizeId(["p1", "p2"]);
    expect(id).toMatch(/^p[a-z0-9]{6}$/);
    // A random source stuck on one value: the second id still differs from the first.
    const stuck = () => 0.5;
    const first = newPrizeId([], stuck);
    const second = newPrizeId([first], stuck);
    expect(second).not.toBe(first);
    expect(second).toMatch(/^[a-z0-9][a-z0-9_-]{0,31}$/);
  });

  it("tells two lists of the same prizes in the same order apart from any other", () => {
    expect(samePrizeIds(DEFAULTS, DEFAULTS.map((item) => ({ ...item, weight: 99 })))).toBe(true);
    expect(samePrizeIds(DEFAULTS, [...DEFAULTS].reverse())).toBe(false);
    expect(samePrizeIds(DEFAULTS, DEFAULTS.slice(1))).toBe(false);
  });
});

describe("a prize's type", () => {
  it("gives the badge type the wheel's own badge", () => {
    expect(wheelBadge([{ id: "guest", rule: "tag" }, { id: "lucky", rule: "spin" }])).toBe("lucky");
    expect(wheelBadge([{ id: "guest", rule: "tag" }])).toBeNull();
  });

  it("keeps an amount only for coins and kudos, and a badge only for the badge type", () => {
    const coins = prize("p1", "coins", 50, 10);
    expect(withKind(coins, "kudos", "lucky")).toMatchObject({ kind: "kudos", amount: 50, badge_id: null });
    expect(withKind(coins, "item", "lucky")).toMatchObject({ kind: "item", amount: 0, badge_id: null });
    expect(withKind(coins, "badge", "lucky")).toMatchObject({ kind: "badge", amount: 0, badge_id: "lucky" });
    expect(withKind(prize("p3", "item", 0, 15), "coins", "lucky")).toMatchObject({ amount: DEFAULT_AMOUNT });
  });

  it("sends the type by its own path, with an amount when it had none", () => {
    expect(kindChanges(prize("p3", "item", 0, 15), "coins", "lucky")).toEqual({
      "spin.prizes.p3.kind": "coins",
      "spin.prizes.p3.amount": DEFAULT_AMOUNT,
    });
    // From coins to kudos the amount stays as it is: nothing else to send.
    expect(kindChanges(prize("p1", "coins", 50, 30), "kudos", "lucky")).toEqual({ "spin.prizes.p1.kind": "kudos" });
    expect(kindChanges(prize("p1", "coins", 50, 30), "item", "lucky")).toEqual({ "spin.prizes.p1.kind": "item" });
  });

  it("sends the badge a badge prize gives", () => {
    expect(kindChanges(prize("p1", "coins", 10, 30), "badge", "lucky")).toEqual({
      "spin.prizes.p1.kind": "badge",
      "spin.prizes.p1.badge_id": "lucky",
    });
  });

  it("names a prize in the reader's language, falling back to English", () => {
    expect(prizeLabel({ label: "Free drink", label_es: "Bebida gratis" }, "es")).toBe("Bebida gratis");
    expect(prizeLabel({ label: "Free drink", label_es: null }, "es")).toBe("Free drink");
    expect(prizeLabel({ label: "Free drink", label_es: "Bebida gratis" }, "en")).toBe("Free drink");
  });
});
