/**
 * The arithmetic the recognition pages draw with: percentages and bar fills, coins in
 * dollars, and the owner's custom shout-out amount. The numbers themselves are the API's
 * (plan D6); this only says them. Pure, so it can be tested on its own.
 */

/** Whole percent of `part` in `whole`; 0 when there is no whole. Not capped, so a budget
 *  that ran over reads as more than 100. */
export function percent(part: number, whole: number): number {
  if (!(whole > 0) || !Number.isFinite(part) || part <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/** How full a bar is drawn, 0 to 100. */
export function barFill(part: number, whole: number): number {
  return Math.min(100, percent(part, whole));
}

/** Coins at the owner's coin value, to the cent. Only ever an estimate (OP-15). */
export function coinsToUsd(coins: number, coinValue: number): number {
  return Math.round(coins * coinValue * 100) / 100;
}

/**
 * The locale numbers are written in. Crew Stars runs in US stores, so Spanish is the US's
 * Spanish: "$1,234.50" and "12,345" in both languages, never "1234,50 US$".
 */
export function numberLocale(locale: string): string {
  return locale.startsWith("es") ? "es-US" : "en-US";
}

/** A count of coins or people, grouped: "12,345". */
export function formatCount(value: number, locale: string): string {
  return new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 0 }).format(value);
}

/** Dollars as the prototype writes them: "$12" when whole, "$12.50" when not. */
export function formatUsd(amount: number, locale: string): string {
  const cents = Math.round(amount * 100);
  const digits = cents % 100 === 0 ? 0 : 2;
  return new Intl.NumberFormat(numberLocale(locale), {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

export type AmountProblem = "required" | "whole" | "range" | "over";

export type AmountCheck = { ok: true; coins: number } | { ok: false; problem: AmountProblem };

/**
 * Whether the owner can send `raw` coins (OP-07): a whole number from the API's `min` to `max`
 * (1 to 5,000), and no more than the coins they have left this month - the Send button is off
 * before the API would refuse it (spec: "the button is disabled before that happens").
 */
export function checkAmount(raw: string, limits: { min: number; max: number; left: number }): AmountCheck {
  const text = raw.trim().replace(/[,\s]/g, "");
  if (text === "") return { ok: false, problem: "required" };
  if (!/^\d+$/.test(text)) return { ok: false, problem: "whole" };
  const coins = Number.parseInt(text, 10);
  if (coins < limits.min || coins > limits.max) return { ok: false, problem: "range" };
  if (coins > limits.left) return { ok: false, problem: "over" };
  return { ok: true, coins };
}
