import type { Schemas } from "@crewstars/api-client";

import type { Range } from "@/components/coins/coin-rules";
import { coinsToUsd } from "@/components/recognition/numbers";

/**
 * Monthly awards (OP-19, OP-20) as plain data: the prize range, what the awards can cost a
 * month, how a leader's number reads, and whether this month's winners can still be
 * announced early. The API picks and pays the winners itself (plan 5.4); these only let the
 * page say what it shows. Pure, so it can be tested on its own.
 */

export type Award = Schemas["Award"];
export type AwardMetric = Award["metric"];
export type StoreAwards = Schemas["StoreAwardsOut"];
export type AwardCategory = Schemas["AwardCategoryOut"];
export type AwardPerson = Schemas["AwardPersonOut"];

/** Prize coins: "0 or more", up to the API's ceiling (models.py MAX_COINS). */
export const AWARD_RANGES = {
  coins: { min: 0, max: 1_000_000 },
} as const satisfies Record<string, Range>;

/** What a category counts: coins this month (Top Earner), the jump in them over last month
 *  (Most Improved), or shout-outs (Guest Hero, Peer Favorite). */
export function metricUnit(metric: AwardMetric): "coins" | "jump" | "shoutouts" {
  if (metric === "earned") return "coins";
  if (metric === "improved") return "jump";
  return "shoutouts";
}

/** The most the awards can pay in a month: every category that is on, in every open store,
 *  in coins and in dollars at the owner's coin value. */
export function monthlyAwardCost(
  awards: readonly Pick<Award, "coins" | "active">[],
  stores: number,
  coinValue: number,
): { coins: number; usd: number } {
  const perStore = awards.reduce((sum, award) => sum + (award.active ? Math.max(0, award.coins) : 0), 0);
  const coins = perStore * Math.max(0, stores);
  return { coins, usd: coinsToUsd(coins, coinValue) };
}

/** Who a category shows for a store: its winner once the month is announced, otherwise
 *  whoever leads now. Null when nobody has scored yet. */
export function standing(category: AwardCategory): { person: AwardPerson; won: boolean } | null {
  if (category.winner) return { person: category.winner, won: true };
  if (category.leader) return { person: category.leader, won: false };
  return null;
}

/**
 * Whether "Announce winners now" can be pressed (OP-20), from every open store's answer (not
 * a filtered one: announcing pays every store at once).
 *
 * - `none`: there is no open store to announce for.
 * - `open`: at least one store's month is still to announce.
 * - `done`: every store's month was announced; when, and by whom, from the latest of them.
 */
export type AnnounceState =
  | { kind: "none" }
  | { kind: "open"; month: string }
  | { kind: "done"; month: string; at: string | null; by: string | null };

export function announceState(stores: readonly StoreAwards[]): AnnounceState {
  const first = stores[0];
  if (!first) return { kind: "none" };
  if (stores.some((store) => !store.announced)) return { kind: "open", month: first.month };
  const latest = stores.reduce((best, store) =>
    (store.announced_at ?? "") > (best.announced_at ?? "") ? store : best,
  );
  return { kind: "done", month: latest.month, at: latest.announced_at, by: latest.announced_by };
}

/** A month key ("2026-11") as a date inside it, for naming the month; null when it is not one. */
export function monthDate(month: string): Date | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const number = Number(match[2]);
  if (number < 1 || number > 12) return null;
  return new Date(Date.UTC(Number(match[1]), number - 1, 15, 12));
}
