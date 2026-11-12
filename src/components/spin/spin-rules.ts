import type { Schemas } from "@crewstars/api-client";

import type { Range } from "@/components/coins/coin-rules";
import { coinsToUsd } from "@/components/recognition/numbers";

/**
 * Spin the wheel (OP-16, OP-17) as plain data: the spec's "Allowed" ranges, each prize's odds,
 * the average coins a spin pays, and the prize list's add and remove (sent whole, as
 * `spin.prizes`, because the list itself changes). The API checks it all again (settings
 * models.py) and picks every prize itself (plan D6); these only let the page show the owner
 * what a change does before it lands. Pure, so it can be tested on its own.
 */

export type Prize = Schemas["Prize"];
export type PrizeKind = Prize["kind"];
type Badge = Pick<Schemas["Badge"], "id" | "rule">;

/** The prize types in the prototype's order (OP-17). */
export const PRIZE_KINDS: readonly PrizeKind[] = ["coins", "kudos", "item", "badge"];

/** The wheel holds 3 to 10 prizes (spec "Prizes"). */
export const MIN_PRIZES = 3;
export const MAX_PRIZES = 10;

/** The spec's "Allowed" column, with the API's ceilings where it says "or more"
 *  (settings/models.py MAX_COINS, Prize.weight). */
export const SPIN_RANGES = {
  everyCoins: { min: 0, max: 1_000_000 },
  maxPerMonth: { min: 0, max: 30 },
  amount: { min: 1, max: 1_000_000 },
  weight: { min: 0, max: 100_000 },
} as const satisfies Record<string, Range>;

/** What a coins or kudos prize pays when it turns into one from a type with no amount. */
export const DEFAULT_AMOUNT = 10;

/** A prize added to the wheel: the prototype's. Labels are data in both languages, not the
 *  portal's words, so they are written here rather than in the message catalogs. */
export const NEW_PRIZE: Omit<Prize, "id"> = {
  label: "+20 coins",
  label_es: "+20 monedas",
  kind: "coins",
  amount: 20,
  weight: 5,
  badge_id: null,
};

/** Coins and extra kudos come in an amount; a free item and the badge do not. */
export function hasAmount(kind: PrizeKind): boolean {
  return kind === "coins" || kind === "kudos";
}

const weightOf = (weight: number) => (Number.isFinite(weight) ? Math.max(0, weight) : 0);

/** Every chance weight together. */
export function totalWeight(prizes: readonly Pick<Prize, "weight">[]): number {
  return prizes.reduce((sum, prize) => sum + weightOf(prize.weight), 0);
}

/** Each prize's chance in percent, to one decimal: its weight over all of them. All 0 when
 *  nothing has a chance (which the API refuses). */
export function odds(prizes: readonly Pick<Prize, "weight">[]): number[] {
  const total = totalWeight(prizes);
  return prizes.map((prize) => (total > 0 ? Math.round((weightOf(prize.weight) / total) * 1000) / 10 : 0));
}

/**
 * What one spin pays in coins on average (OP-17), to one decimal, and in dollars at the
 * owner's coin value: each coin prize's amount by its chance. Extra kudos, free items and the
 * badge are not earned coins, so they count for nothing here.
 */
export function averagePerSpin(
  prizes: readonly Pick<Prize, "kind" | "amount" | "weight">[],
  coinValue: number,
): { coins: number; usd: number } {
  const total = totalWeight(prizes);
  if (total <= 0) return { coins: 0, usd: 0 };
  const coins =
    prizes.reduce((sum, prize) => sum + (prize.kind === "coins" ? prize.amount * weightOf(prize.weight) : 0), 0) /
    total;
  return { coins: Math.round(coins * 10) / 10, usd: coinsToUsd(coins, coinValue) };
}

/** Whether a free item can come up, which the average leaves out. */
export function hasItems(prizes: readonly Pick<Prize, "kind" | "weight">[]): boolean {
  return prizes.some((prize) => prize.kind === "item" && weightOf(prize.weight) > 0);
}

export const canAdd = (count: number) => count < MAX_PRIZES;
export const canRemove = (count: number) => count > MIN_PRIZES;

const ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;

/** A new prize's id: short, the API's form (`p` and letters or digits), and none of `taken`.
 *  Random, so two owners adding at once do not pick the same one. */
export function newPrizeId(taken: readonly string[], random: () => number = Math.random): string {
  const used = new Set(taken);
  for (let attempt = 0; attempt < 20; attempt++) {
    const id = `p${Math.floor(random() * 36 ** 6)
      .toString(36)
      .padStart(6, "0")}`;
    if (ID.test(id) && !used.has(id)) return id;
  }
  // A random source that keeps repeating itself: count up instead.
  let n = taken.length + 1;
  while (used.has(`p${n}`)) n++;
  return `p${n}`;
}

/** The list with a new prize at the end, or null when the wheel is full. */
export function withPrizeAdded(prizes: readonly Prize[], id: string): Prize[] | null {
  if (!canAdd(prizes.length) || prizes.some((prize) => prize.id === id)) return null;
  return [...prizes, { id, ...NEW_PRIZE }];
}

/** The list without the prize `id`, or null when the wheel is at its fewest or has no such
 *  prize. */
export function withPrizeRemoved(prizes: readonly Prize[], id: string): Prize[] | null {
  if (!canRemove(prizes.length) || !prizes.some((prize) => prize.id === id)) return null;
  return prizes.filter((prize) => prize.id !== id);
}

/** The badge the "Lucky Star badge" prize gives: the one only the wheel gives (rule `spin`).
 *  Null when there is none, and then that type is not offered. */
export function wheelBadge(badges: readonly Badge[]): string | null {
  return badges.find((badge) => badge.rule === "spin")?.id ?? null;
}

/** A prize as it stands once its type is `kind`, as the API will keep it: an amount only for
 *  coins and kudos (the old one, or DEFAULT_AMOUNT when it had none), and the wheel's badge
 *  only for the badge type. */
export function withKind(prize: Prize, kind: PrizeKind, badgeId: string | null): Prize {
  return {
    ...prize,
    kind,
    amount: hasAmount(kind) ? (prize.amount >= 1 ? prize.amount : DEFAULT_AMOUNT) : 0,
    badge_id: kind === "badge" ? badgeId : null,
  };
}

/**
 * The PATCH for a prize's type change: the type, and whatever the new type needs that the
 * prize does not have yet - an amount when it had none, the badge it gives - each by its own
 * path, so a name being typed in the same row is never overwritten. `saved` is the prize as
 * the API holds it.
 */
export function kindChanges(saved: Prize, kind: PrizeKind, badgeId: string | null): Record<string, unknown> {
  const at = (field: string) => `spin.prizes.${saved.id}.${field}`;
  const next = withKind(saved, kind, badgeId);
  const changes: Record<string, unknown> = { [at("kind")]: kind };
  if (hasAmount(kind) && saved.amount !== next.amount) changes[at("amount")] = next.amount;
  if (kind === "badge") changes[at("badge_id")] = next.badge_id;
  return changes;
}

/** Two prize lists are the same wheel: the same prizes, in the same order. */
export function samePrizeIds(a: readonly Pick<Prize, "id">[], b: readonly Pick<Prize, "id">[]): boolean {
  return a.length === b.length && a.every((prize, index) => prize.id === b[index]?.id);
}

/** A prize's label in the reader's language: the Spanish one when there is one (plan G8). */
export function prizeLabel(prize: Pick<Prize, "label" | "label_es">, locale: string): string {
  return locale.startsWith("es") && prize.label_es ? prize.label_es : prize.label;
}
