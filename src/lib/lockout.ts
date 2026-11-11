/** An ISO time with no offset is read as UTC, which is what the API always means. */
const HAS_OFFSET = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * Whole minutes until a lockout ends (`account_locked` carries `details.until`, CR-07), for
 * "Try again in 12 minutes". Rounded up, and never below 1: the API has just said the account
 * is locked, so "0 minutes" (or a clock a little ahead of the server's) would only mislead.
 * Null when `until` is missing or not a time, and the caller falls back to the plain message.
 */
export function minutesUntil(until: unknown, now: number = Date.now()): number | null {
  if (typeof until !== "string" || until.trim() === "") return null;
  const text = until.trim();
  const end = Date.parse(HAS_OFFSET.test(text) || !text.includes("T") ? text : `${text}Z`);
  if (Number.isNaN(end)) return null;
  return Math.max(1, Math.ceil((end - now) / 60_000));
}

/**
 * How many minutes an `account_locked` (or `code_locked`, `rate_limited`) has left, from its
 * details: `retry_after_s` when the API sends it, which is counted on the server's clock so a
 * browser clock that is off cannot skew it, otherwise `until`. Rounded up, never below 1; null
 * when the details say neither.
 */
export function lockMinutes(details: unknown, now: number = Date.now()): number | null {
  if (typeof details !== "object" || details === null) return null;
  const { retry_after_s: wait, until } = details as { retry_after_s?: unknown; until?: unknown };
  if (typeof wait === "number" && Number.isFinite(wait) && wait >= 0) {
    return Math.max(1, Math.ceil(wait / 60));
  }
  return minutesUntil(until, now);
}
