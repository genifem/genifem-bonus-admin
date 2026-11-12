/**
 * Sending a shout-out exactly once (plan D13).
 *
 * Every send carries an Idempotency-Key, and the API answers a key it has seen with the post
 * it already made. So the key belongs to the owner's intent, not to the request: pressing Send
 * again after a network error, for the same person, tag, amount and message, reuses it, and
 * the shout-out cannot go out twice. Once the API has answered - sent, or refused - the intent
 * is over, and the next press is a new one with a new key. Changing anything about the draft
 * is a new intent too: the API would otherwise answer the new draft with the old post.
 *
 * Pure (the key maker is passed in for the tests), so it can be tested on its own.
 */

export type TagId = "guest" | "rush" | "team" | "clean" | "above" | "lead";

export const TAGS: readonly TagId[] = ["guest", "rush", "team", "clean", "above", "lead"];

export interface ShoutoutDraft {
  to_id: string;
  tag: TagId;
  coins: number;
  message: string | null;
}

export interface SendIntent {
  /** What is being sent, so a changed draft is a new intent. */
  fingerprint: string;
  key: string;
}

/** The request body for a draft: the message without its outer spaces, or none at all. */
export function shoutoutBody(draft: ShoutoutDraft): ShoutoutDraft {
  const message = draft.message?.trim() ?? "";
  return { to_id: draft.to_id, tag: draft.tag, coins: draft.coins, message: message || null };
}

function fingerprintOf(draft: ShoutoutDraft): string {
  const body = shoutoutBody(draft);
  return JSON.stringify([body.to_id, body.tag, body.coins, body.message]);
}

/** The intent sending `draft` belongs to: the one still pending when this is the same send
 *  tried again, otherwise a new one with a new key. */
export function intentFor(
  pending: SendIntent | null,
  draft: ShoutoutDraft,
  makeKey: () => string = newIdempotencyKey,
): SendIntent {
  const fingerprint = fingerprintOf(draft);
  if (pending && pending.fingerprint === fingerprint) return pending;
  return { fingerprint, key: makeKey() };
}

/** How a try ended: the API made the post (or had already), the API said no, or nobody
 *  knows - the request or its answer was lost, or the server failed part-way. */
export type SendOutcome = "sent" | "refused" | "unknown";

export function outcomeOf(failure: { status: number }): SendOutcome {
  return failure.status >= 400 && failure.status < 500 ? "refused" : "unknown";
}

/** The intent still pending after a try: kept only when the outcome is unknown, so pressing
 *  Send again repeats the same request rather than making a second post. */
export function afterAttempt(intent: SendIntent, outcome: SendOutcome): SendIntent | null {
  return outcome === "unknown" ? intent : null;
}

interface RandomSource {
  randomUUID?: () => string;
  getRandomValues: <T extends ArrayBufferView>(array: T) => T;
}

/**
 * A random UUID (v4) for the Idempotency-Key header. `crypto.randomUUID` exists only on secure
 * origins (https, localhost); a portal opened over plain http on a LAN address builds the same
 * thing from `getRandomValues`, which exists everywhere.
 */
export function newIdempotencyKey(source: RandomSource = globalThis.crypto): string {
  if (typeof source.randomUUID === "function") return source.randomUUID();
  const bytes = source.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** A refused send in words: `errors.<code>`, with the values its message takes. */
export interface SendProblem {
  code: string;
  values: { left: number; max: number };
}

/** What the form says about a failed send. `kudos_insufficient` says how many coins are left
 *  (`details.kudos_left`), `message_too_long` the longest message (`details.max`). */
export function sendProblem(
  failure: { code: string; details?: unknown },
  fallback: { left: number; max: number },
): SendProblem {
  const details = isRecord(failure.details) ? failure.details : {};
  const left = typeof details.kudos_left === "number" ? details.kudos_left : fallback.left;
  const max = typeof details.max === "number" ? details.max : fallback.max;
  return { code: failure.code, values: { left, max } };
}
