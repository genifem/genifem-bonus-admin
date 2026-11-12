import type { Schemas } from "@crewstars/api-client";

import type { Range } from "@/components/coins/coin-rules";

/**
 * Badges & tiers (OP-18) as plain data: the spec's "Allowed" ranges, the check that tier
 * thresholds keep increasing from Bronze's fixed 0, and the people counts beside each. The API
 * checks everything again (settings models.py) and works tiers out from lifetime coins on every
 * read (plan D16), so a threshold change moves people at once. Pure, so it can be tested on its
 * own.
 */

export type Tier = Schemas["Tier"];
export type Badge = Schemas["Badge"];
export type BadgeRule = Badge["rule"];
type Count = { id: string; people: number };

/** The spec's "Allowed" column, with the API's ceilings (models.py Badge, Tier, MAX_COINS).
 *  A tier above Bronze starts at 1 or more: it must be above Bronze's 0. */
export const BADGE_RANGES = {
  count: { min: 1, max: 10_000 },
  bonus: { min: 0, max: 1_000_000 },
  tierMin: { min: 1, max: 1_000_000 },
} as const satisfies Record<string, Range>;

/** Why a threshold does not fit: not above the tier before it, or not below the one after. */
export type TierProblem = "low" | "high";

/**
 * Whether `value` fits as tier `index`'s threshold among `mins` (every tier's, lowest first,
 * as the owner has them now): above the tier before it and below the one after. Bronze (index
 * 0) is fixed at 0 and never asked about.
 */
export function tierProblem(mins: readonly number[], index: number, value: number): TierProblem | null {
  if (index <= 0) return null;
  const below = mins[index - 1];
  if (below !== undefined && value <= below) return "low";
  const above = mins[index + 1];
  if (above !== undefined && value >= above) return "high";
  return null;
}

/** The people count for `id` in an answer of GET /portal/badges-tiers, or null when it did
 *  not load (the page then says it does not know rather than 0). */
export function peopleWith(counts: readonly Count[] | null, id: string): number | null {
  if (!counts) return null;
  return counts.find((count) => count.id === id)?.people ?? 0;
}

/** Whether a badge's rule has a count to set: shout-outs received with a tag, shout-outs
 *  given, days on the team. The wheel's own badge (Lucky Star) is only ever won. */
export function ruleHasCount(rule: BadgeRule): boolean {
  return rule !== "spin";
}
