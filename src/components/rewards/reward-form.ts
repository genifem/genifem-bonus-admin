import type { Schemas } from "@crewstars/api-client";

import { parseWhole } from "@/components/coins/coin-rules";

/**
 * The Add / Edit reward form (OP-11) as plain data, the request bodies it turns into, and how
 * a reward's unlock rule reads in the table (OP-10). Pure, so the rules about what is sent and
 * said can be tested without a browser.
 */

type RewardAdminOut = Schemas["RewardAdminOut"];
type RewardIn = Schemas["RewardIn"];
type RewardPatch = Schemas["RewardPatch"];
type Tier = Pick<Schemas["Tier"], "id" | "name" | "name_es" | "min">;
type Badge = Pick<Schemas["Badge"], "id" | "name" | "name_es">;
export type UnlockType = Schemas["UnlockIn"]["type"];

/** The API's bounds (rewards/models.py, settings MAX_COINS). */
export const REWARD_LIMITS = {
  name: 60,
  description: 200,
  cost: { min: 1, max: 1_000_000 },
  perMonth: { min: 1, max: 100 },
} as const;

/** What a new reward starts as: the prototype's blank. */
export const NEW_REWARD = { icon: "gift", cost: 100, perMonth: 1 } as const;

export interface RewardDraft {
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  icon: string;
  /** As typed. */
  cost: string;
  perMonth: string;
  unlockType: UnlockType;
  tierId: string;
  badgeId: string;
  active: boolean;
  isCash: boolean;
}

/** The form for a new reward, or filled in from one. A tier or badge not yet chosen starts
 *  on `fallback`'s (the second tier, the first badge), as the prototype's does. */
export function rewardDraft(
  reward: RewardAdminOut | null,
  fallback: { tierId: string; badgeId: string },
): RewardDraft {
  const unlock = reward?.unlock ?? { type: "none" as const, id: null };
  return {
    name: reward?.name ?? "",
    nameEs: reward?.name_es ?? "",
    description: reward?.description ?? "",
    descriptionEs: reward?.description_es ?? "",
    icon: reward?.icon ?? NEW_REWARD.icon,
    cost: String(reward?.cost ?? NEW_REWARD.cost),
    perMonth: String(reward?.per_person_monthly ?? NEW_REWARD.perMonth),
    unlockType: unlock.type,
    tierId: unlock.type === "tier" && unlock.id ? unlock.id : fallback.tierId,
    badgeId: unlock.type === "badge" && unlock.id ? unlock.id : fallback.badgeId,
    active: reward?.active ?? true,
    isCash: reward?.is_cash ?? false,
  };
}

/** The fields the form checks before it sends anything, and why. */
export type RewardField = "name" | "cost" | "per_person_monthly" | "unlock";
export type RewardProblem = "required" | "whole" | "range" | "choose";

export type RewardCheck =
  | { ok: true; body: RewardIn }
  | { ok: false; problems: Partial<Record<RewardField, RewardProblem>> };

const oneLine = (text: string) => text.trim().replace(/\s+/g, " ");

/** The draft as POST /portal/rewards takes it, or what is wrong with it. */
export function checkReward(draft: RewardDraft): RewardCheck {
  const problems: Partial<Record<RewardField, RewardProblem>> = {};
  const name = oneLine(draft.name);
  if (!name) problems.name = "required";
  const cost = parseWhole(draft.cost, REWARD_LIMITS.cost);
  if (!cost.ok) problems.cost = cost.problem === "required" ? "required" : cost.problem === "range" ? "range" : "whole";
  const perMonth = parseWhole(draft.perMonth, REWARD_LIMITS.perMonth);
  if (!perMonth.ok) {
    problems.per_person_monthly =
      perMonth.problem === "required" ? "required" : perMonth.problem === "range" ? "range" : "whole";
  }
  const unlockId = draft.unlockType === "tier" ? draft.tierId : draft.unlockType === "badge" ? draft.badgeId : null;
  if (draft.unlockType !== "none" && !unlockId) problems.unlock = "choose";
  if (!cost.ok || !perMonth.ok || Object.keys(problems).length > 0) return { ok: false, problems };
  return {
    ok: true,
    body: {
      name,
      name_es: oneLine(draft.nameEs) || null,
      description: oneLine(draft.description),
      description_es: oneLine(draft.descriptionEs) || null,
      icon: draft.icon,
      cost: cost.value,
      per_person_monthly: perMonth.value,
      unlock: draft.unlockType === "none" ? { type: "none" } : { type: draft.unlockType, id: unlockId },
      active: draft.active,
      is_cash: draft.isCash,
    },
  };
}

/** Only what changed, for PATCH /portal/rewards/{id}; empty when nothing did. A cleared
 *  Spanish name is sent as null, which the API takes as "use the English one". */
export function rewardPatch(reward: RewardAdminOut, body: RewardIn): RewardPatch {
  const patch: RewardPatch = {};
  if (body.name !== reward.name) patch.name = body.name;
  if ((body.name_es ?? null) !== (reward.name_es ?? null)) patch.name_es = body.name_es ?? null;
  if (body.description !== reward.description) patch.description = body.description;
  if ((body.description_es ?? null) !== (reward.description_es ?? null)) {
    patch.description_es = body.description_es ?? null;
  }
  if (body.icon !== reward.icon) patch.icon = body.icon;
  if (body.cost !== reward.cost) patch.cost = body.cost;
  if (body.per_person_monthly !== reward.per_person_monthly) patch.per_person_monthly = body.per_person_monthly;
  const unlock = body.unlock ?? { type: "none" };
  if (unlock.type !== reward.unlock.type || (unlock.id ?? null) !== (reward.unlock.id ?? null)) patch.unlock = unlock;
  if (body.active !== reward.active) patch.active = body.active;
  if (body.is_cash !== reward.is_cash) patch.is_cash = body.is_cash;
  return patch;
}

/** An owner-entered name in the reader's language: the Spanish one when there is one (plan
 *  G8), the English one otherwise. */
export function localName(item: { name: string; name_es?: string | null }, locale: string): string {
  return locale.startsWith("es") && item.name_es ? item.name_es : item.name;
}

/** A reward's description, in the same way. */
export function localDescription(
  item: { description: string; description_es?: string | null },
  locale: string,
): string {
  return locale.startsWith("es") && item.description_es ? item.description_es : item.description;
}

/**
 * Who can redeem a reward, as the table says it: anyone, from a tier up, or with a badge, by
 * its name in the reader's language. A tier or badge the settings no longer have is said by
 * its id, flagged `missing`, so an owner can see the rule needs fixing.
 */
export type UnlockRule =
  | { kind: "anyone" }
  | { kind: "tier"; name: string; min: number | null; missing: boolean }
  | { kind: "badge"; name: string; missing: boolean };

export function describeUnlock(
  unlock: Schemas["UnlockOut"],
  rules: { tiers: readonly Tier[]; badges: readonly Badge[] },
  locale: string,
): UnlockRule {
  if (unlock.type === "tier") {
    const tier = rules.tiers.find((item) => item.id === unlock.id);
    return tier
      ? { kind: "tier", name: localName(tier, locale), min: tier.min, missing: false }
      : { kind: "tier", name: unlock.id ?? "", min: null, missing: true };
  }
  if (unlock.type === "badge") {
    const badge = rules.badges.find((item) => item.id === unlock.id);
    return badge
      ? { kind: "badge", name: localName(badge, locale), missing: false }
      : { kind: "badge", name: unlock.id ?? "", missing: true };
  }
  return { kind: "anyone" };
}

/** The tier a new "from a tier up" rule starts on: the first above the bottom one. */
export function defaultTier(tiers: readonly Tier[]): string {
  return tiers[1]?.id ?? tiers[0]?.id ?? "";
}
