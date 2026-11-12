/**
 * The payroll export (NF-12, plan G4): approved cash and gift-card rewards for one month, as a
 * CSV from GET /portal/redemptions/payroll.csv?month=YYYY-MM, fetched through the BFF.
 *
 * Months are the API's "YYYY-MM" keys in the operator's time zone. The page starts on the
 * month the API reports for the store budgets (so it is the operator's month, not the
 * server's), and offers the year before it. Pure, so it can be tested on its own.
 */

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** How many months the picker offers, this one included. */
export const PAYROLL_MONTHS = 12;

export function isMonthKey(value: unknown): value is string {
  return typeof value === "string" && MONTH_KEY.test(value);
}

/** The month `date` falls in, in `timeZone`. */
export function monthKeyOf(date: Date, timeZone = "UTC"): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${month}`;
}

/** `key` moved by `by` months (negative: earlier). */
export function shiftMonth(key: string, by: number): string {
  const match = MONTH_KEY.exec(key);
  if (!match) throw new Error(`not a month: ${key}`);
  const index = Number(match[1]) * 12 + (Number(match[2]) - 1) + by;
  const year = Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/** `current` and the months before it, newest first. */
export function recentMonths(current: string, count = PAYROLL_MONTHS): string[] {
  return Array.from({ length: Math.max(1, count) }, (_, back) => shiftMonth(current, -back));
}

/** The first day of the month, at midnight UTC: what a formatter set to UTC names it by. */
export function monthStart(key: string): Date {
  const match = MONTH_KEY.exec(key);
  if (!match) throw new Error(`not a month: ${key}`);
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1));
}

/** The month the page starts on: the API's (any store's budget month), else `fallback`'s. */
export function defaultPayrollMonth(apiMonths: readonly string[], fallback: Date): string {
  return apiMonths.find(isMonthKey) ?? monthKeyOf(fallback);
}

/** The API path for a month's export (lib/api.ts puts it behind /api/v1). */
export function payrollPath(month: string): string {
  if (!isMonthKey(month)) throw new Error(`not a month: ${month}`);
  return `/portal/redemptions/payroll.csv?month=${month}`;
}

/** The name to save the file under: the API's, from its Content-Disposition, else ours. */
export function payrollFileName(month: string, disposition: string | null): string {
  const named = disposition ? /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] : undefined;
  const safe = named?.trim().replace(/[\\/:*?"<>|]/g, "");
  return safe || `crew-stars-payroll-${month}.csv`;
}
