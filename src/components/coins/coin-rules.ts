import type { Schemas } from "@crewstars/api-client";

import { coinsToUsd } from "@/components/recognition/numbers";

import type { Parsed } from "./autosave";

/**
 * Coins & limits (OP-13 to OP-15) as plain data: the roles in the prototype's order, the
 * spec's "Allowed" ranges for each number, how a typed number is read, and the estimates the
 * page draws under them. The API checks every range again (models.py); these only let the
 * page say so before it asks. Pure, so it can be tested on its own.
 */

export type GivingRole = keyof Schemas["Allowance"];
/** Every role with an allowance and amounts, owners last (OP-13). */
export const GIVING_ROLES: readonly GivingRole[] = ["crew", "shift", "gm", "supervisor", "director", "owner"];

export type ScopeRole = keyof Schemas["Scope"];
/** The roles with a scope to pick; owners always reach everyone (OP-14). */
export const SCOPE_ROLES: readonly ScopeRole[] = ["crew", "shift", "gm", "supervisor", "director"];

export type ScopeKind = Schemas["Scope"]["crew"];
export const SCOPE_KINDS: readonly ScopeKind[] = ["store", "stores", "area", "all"];

export interface Range {
  min: number;
  max: number;
}

/** The spec's "Allowed" column, with the API's ceilings where the spec says "or more"
 *  (settings/models.py MAX_COINS and MAX_AMOUNT). */
export const RANGES = {
  allowance: { min: 0, max: 1_000_000 },
  amount: { min: 1, max: 5_000 },
  maxCoins: { min: 0, max: 1_000_000 },
  maxRewards: { min: 1, max: 50 },
  storeBudget: { min: 0, max: 1_000_000 },
  coinValue: { min: 0.01, max: 10 },
} as const satisfies Record<string, Range>;

/** Why a typed number was refused: empty, not a whole number, more than cents, out of range. */
export type NumberProblem = "required" | "whole" | "cents" | "range";

/** The longest name a badge, prize, tier or award can have, in either language
 *  (settings/models.py: max_length=40). */
export const NAME_MAX = 40;

/** Why a typed name was refused: empty (when one is needed), or too long. */
export type NameProblem = "required" | "long";

/** Typing allows thousands separators and spaces ("4,000"). */
const clean = (raw: string) => raw.trim().replace(/[,\s]/g, "");

/** A whole number of coins within `range`. */
export function parseWhole(raw: string, range: Range): Parsed<number> {
  const text = clean(raw);
  if (text === "") return { ok: false, problem: "required" };
  if (!/^\d+$/.test(text)) return { ok: false, problem: "whole" };
  const value = Number.parseInt(text, 10);
  if (value < range.min || value > range.max) return { ok: false, problem: "range" };
  return { ok: true, value };
}

/** Dollars and cents within `range` ("0.10", ".1", "$1"). */
export function parseDollars(raw: string, range: Range): Parsed<number> {
  const text = clean(raw).replace(/^\$/, "");
  if (text === "") return { ok: false, problem: "required" };
  if (!/^(\d+\.?\d*|\.\d+)$/.test(text)) return { ok: false, problem: "whole" };
  if (/\.\d{3,}$/.test(text)) return { ok: false, problem: "cents" };
  const value = Math.round(Number.parseFloat(text) * 100) / 100;
  if (value < range.min || value > range.max) return { ok: false, problem: "range" };
  return { ok: true, value };
}

/**
 * A name as the API keeps it: spaces trimmed and runs of them made one (models.py
 * _clean_name). A Spanish name is `optional`: left blank, it is null, and the app uses the
 * English one (plan G8).
 */
export function parseName(raw: string, { optional = false, max = NAME_MAX } = {}): Parsed<string | null> {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text === "") return optional ? { ok: true, value: null } : { ok: false, problem: "required" };
  if (text.length > max) return { ok: false, problem: "long" };
  return { ok: true, value: text };
}

/** A coin value as the box shows it: always with its cents ("0.10"). */
export function formatDollars(value: number): string {
  return value.toFixed(2);
}

/**
 * The worst case for crew allowances (OP-13): every crew member gives away their whole
 * allowance in a month. Counted for crew only, at the crew allowance; shift managers have
 * an allowance of their own.
 */
export function worstCase(crew: number, allowance: number, coinValue: number): { coins: number; usd: number } {
  const coins = Math.max(0, crew) * Math.max(0, allowance);
  return { coins, usd: coinsToUsd(coins, coinValue) };
}

/** The store budget in dollars, for one store and for every open one (OP-15). */
export function budgetEstimate(
  budget: number,
  coinValue: number,
  stores: number,
): { perStore: number; total: number } {
  const perStore = coinsToUsd(budget, coinValue);
  return { perStore, total: coinsToUsd(budget * Math.max(0, stores), coinValue) };
}
