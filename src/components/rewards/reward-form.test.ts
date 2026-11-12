import type { Schemas } from "@crewstars/api-client";
import { describe, expect, it } from "vitest";

import {
  checkReward,
  defaultTier,
  describeUnlock,
  localDescription,
  localName,
  rewardDraft,
  rewardPatch,
} from "./reward-form";

const TIERS = [
  { id: "bronze", name: "Bronze", name_es: "Bronce", min: 0 },
  { id: "silver", name: "Silver", name_es: "Plata", min: 250 },
  { id: "gold", name: "Gold", name_es: null, min: 600 },
] as const;
const BADGES = [
  { id: "guest", name: "Guest Hero", name_es: "Héroe del cliente" },
  { id: "d90", name: "90 Days Strong", name_es: null },
] as const;
const RULES = { tiers: [...TIERS], badges: [...BADGES] };

const GIFT_CARD: Schemas["RewardAdminOut"] = {
  id: "6af5b1ba33a7e1d296071f00",
  name: "$10 gift card",
  name_es: "Tarjeta de regalo de $10",
  description: "A little something, just for you",
  description_es: null,
  icon: "gift",
  cost: 250,
  cost_usd: 25,
  unlock: { type: "tier", id: "silver" },
  per_person_monthly: 1,
  active: false,
  is_cash: true,
  pending: 0,
};

const FALLBACK = { tierId: "silver", badgeId: "guest" };

describe("describeUnlock", () => {
  it("says anyone, a tier or a badge, by its name in the reader's language", () => {
    expect(describeUnlock({ type: "none", id: null }, RULES, "en")).toEqual({ kind: "anyone" });
    expect(describeUnlock({ type: "tier", id: "silver" }, RULES, "en")).toEqual({
      kind: "tier",
      name: "Silver",
      min: 250,
      missing: false,
    });
    expect(describeUnlock({ type: "tier", id: "silver" }, RULES, "es")).toMatchObject({ name: "Plata" });
    expect(describeUnlock({ type: "badge", id: "guest" }, RULES, "es")).toEqual({
      kind: "badge",
      name: "Héroe del cliente",
      missing: false,
    });
  });

  it("falls back to English where there is no Spanish name", () => {
    expect(describeUnlock({ type: "tier", id: "gold" }, RULES, "es")).toMatchObject({ name: "Gold" });
    expect(describeUnlock({ type: "badge", id: "d90" }, RULES, "es")).toMatchObject({ name: "90 Days Strong" });
  });

  it("flags a tier or badge the settings no longer have", () => {
    expect(describeUnlock({ type: "badge", id: "gone" }, RULES, "en")).toEqual({
      kind: "badge",
      name: "gone",
      missing: true,
    });
    expect(describeUnlock({ type: "tier", id: null }, RULES, "en")).toEqual({
      kind: "tier",
      name: "",
      min: null,
      missing: true,
    });
  });
});

describe("localName and localDescription", () => {
  it("use the Spanish words when there are some", () => {
    expect(localName(GIFT_CARD, "es")).toBe("Tarjeta de regalo de $10");
    expect(localName(GIFT_CARD, "en")).toBe("$10 gift card");
    expect(localDescription(GIFT_CARD, "es")).toBe("A little something, just for you");
  });
});

describe("rewardDraft", () => {
  it("starts a new reward as the prototype's blank, visible in the app", () => {
    expect(rewardDraft(null, FALLBACK)).toEqual({
      name: "",
      nameEs: "",
      description: "",
      descriptionEs: "",
      icon: "gift",
      cost: "100",
      perMonth: "1",
      unlockType: "none",
      tierId: "silver",
      badgeId: "guest",
      active: true,
      isCash: false,
    });
  });

  it("fills in a reward, keeping the other rule's choice ready", () => {
    expect(rewardDraft(GIFT_CARD, FALLBACK)).toMatchObject({
      name: "$10 gift card",
      nameEs: "Tarjeta de regalo de $10",
      descriptionEs: "",
      cost: "250",
      unlockType: "tier",
      tierId: "silver",
      badgeId: "guest",
      active: false,
      isCash: true,
    });
    expect(defaultTier(TIERS)).toBe("silver");
    expect(defaultTier([])).toBe("");
  });
});

describe("checkReward", () => {
  it("builds the body the API takes, tidying the words", () => {
    const draft = { ...rewardDraft(null, FALLBACK), name: "  Free  fries ", nameEs: " ", cost: "1,000", perMonth: "2" };
    expect(checkReward(draft)).toEqual({
      ok: true,
      body: {
        name: "Free fries",
        name_es: null,
        description: "",
        description_es: null,
        icon: "gift",
        cost: 1000,
        per_person_monthly: 2,
        unlock: { type: "none" },
        active: true,
        is_cash: false,
      },
    });
  });

  it("sends the chosen tier or badge with its rule", () => {
    const base = { ...rewardDraft(null, FALLBACK), name: "Hoodie" };
    const tier = checkReward({ ...base, unlockType: "tier", tierId: "gold" });
    expect(tier.ok && tier.body.unlock).toEqual({ type: "tier", id: "gold" });
    const badge = checkReward({ ...base, unlockType: "badge" });
    expect(badge.ok && badge.body.unlock).toEqual({ type: "badge", id: "guest" });
  });

  it("says what is wrong before anything is sent", () => {
    const draft = { ...rewardDraft(null, { tierId: "", badgeId: "" }), cost: "0", perMonth: "1.5" };
    expect(checkReward({ ...draft, unlockType: "badge" })).toEqual({
      ok: false,
      problems: { name: "required", cost: "range", per_person_monthly: "whole", unlock: "choose" },
    });
    expect(checkReward({ ...draft, name: "x", cost: "", perMonth: "101" })).toEqual({
      ok: false,
      problems: { cost: "required", per_person_monthly: "range" },
    });
  });
});

describe("rewardPatch", () => {
  const body = (changes: Partial<ReturnType<typeof rewardDraft>>) => {
    const check = checkReward({ ...rewardDraft(GIFT_CARD, FALLBACK), ...changes });
    if (!check.ok) throw new Error("bad draft");
    return check.body;
  };

  it("is empty when nothing changed", () => {
    expect(rewardPatch(GIFT_CARD, body({}))).toEqual({});
  });

  it("sends only what changed, a cleared Spanish name as null", () => {
    expect(rewardPatch(GIFT_CARD, body({ cost: "300", nameEs: "", active: true }))).toEqual({
      cost: 300,
      name_es: null,
      active: true,
    });
    expect(rewardPatch(GIFT_CARD, body({ unlockType: "none" }))).toEqual({ unlock: { type: "none" } });
    expect(rewardPatch(GIFT_CARD, body({ tierId: "gold" }))).toEqual({ unlock: { type: "tier", id: "gold" } });
  });
});
