import { describe, expect, it } from "vitest";

import {
  afterAttempt,
  intentFor,
  newIdempotencyKey,
  outcomeOf,
  sendProblem,
  shoutoutBody,
  type ShoutoutDraft,
} from "./send-intent";

const DRAFT: ShoutoutDraft = { to_id: "6af58bb8c176266fac49d596", tag: "guest", coins: 100, message: "Great rush" };

/** A key maker that counts, so a test can tell a new key from a reused one. */
function keys() {
  let n = 0;
  return () => `key-${++n}-0000`;
}

describe("shoutoutBody", () => {
  it("trims the message and sends none when it is empty", () => {
    expect(shoutoutBody({ ...DRAFT, message: "  Thanks!  " }).message).toBe("Thanks!");
    expect(shoutoutBody({ ...DRAFT, message: "   " }).message).toBeNull();
    expect(shoutoutBody({ ...DRAFT, message: null }).message).toBeNull();
  });
});

describe("one Idempotency-Key per send intent (plan D13)", () => {
  it("starts a new intent with a new key", () => {
    const make = keys();
    expect(intentFor(null, DRAFT, make).key).toBe("key-1-0000");
  });

  it("reuses the key when the same send is tried again after a network error", () => {
    const make = keys();
    const first = intentFor(null, DRAFT, make);
    const pending = afterAttempt(first, outcomeOf({ status: 0 }));
    expect(pending).toBe(first);
    expect(intentFor(pending, DRAFT, make).key).toBe(first.key);
    // Spaces around the message do not make it a different send.
    expect(intentFor(pending, { ...DRAFT, message: " Great rush " }, make).key).toBe(first.key);
  });

  it("reuses it after a server error too: the post may have been made", () => {
    const make = keys();
    const first = intentFor(null, DRAFT, make);
    expect(afterAttempt(first, outcomeOf({ status: 502 }))).toBe(first);
  });

  it("takes a new key once the API has answered, so the next send is its own", () => {
    const make = keys();
    const first = intentFor(null, DRAFT, make);
    expect(afterAttempt(first, "sent")).toBeNull();
    expect(afterAttempt(first, outcomeOf({ status: 409 }))).toBeNull();
    expect(intentFor(afterAttempt(first, "sent"), DRAFT, make).key).toBe("key-2-0000");
  });

  it("takes a new key when anything about the draft changed", () => {
    const make = keys();
    const first = intentFor(null, DRAFT, make);
    for (const changed of [
      { ...DRAFT, coins: 200 },
      { ...DRAFT, tag: "team" as const },
      { ...DRAFT, to_id: "6af58bb9c176266fac49d5a1" },
      { ...DRAFT, message: "Great rush!" },
    ]) {
      expect(intentFor(first, changed, make).key).not.toBe(first.key);
    }
  });

  it("calls a 4xx refused and anything else unknown", () => {
    expect(outcomeOf({ status: 403 })).toBe("refused");
    expect(outcomeOf({ status: 422 })).toBe("refused");
    expect(outcomeOf({ status: 429 })).toBe("refused");
    expect(outcomeOf({ status: 0 })).toBe("unknown");
    expect(outcomeOf({ status: 500 })).toBe("unknown");
  });
});

describe("newIdempotencyKey", () => {
  // The API accepts 8 to 128 letters, digits, dashes and underscores.
  const ACCEPTED = /^[A-Za-z0-9_-]{8,128}$/;
  const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("is a UUID the API accepts, different every time", () => {
    const a = newIdempotencyKey();
    const b = newIdempotencyKey();
    expect(a).toMatch(ACCEPTED);
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  it("builds one from random bytes where randomUUID is missing (plain http)", () => {
    const key = newIdempotencyKey({ getRandomValues: (array) => globalThis.crypto.getRandomValues(array) });
    expect(key).toMatch(UUID_V4);
    expect(key).toMatch(ACCEPTED);
  });
});

describe("sendProblem", () => {
  const fallback = { left: 2000, max: 200 };

  it("says how many coins are left on kudos_insufficient", () => {
    expect(sendProblem({ code: "kudos_insufficient", details: { kudos_left: 40 } }, fallback)).toEqual({
      code: "kudos_insufficient",
      values: { left: 40, max: 200 },
    });
  });

  it("says the longest message on message_too_long", () => {
    expect(sendProblem({ code: "message_too_long", details: { max: 140 } }, fallback).values.max).toBe(140);
  });

  it("falls back to what the page knows when the details are missing", () => {
    expect(sendProblem({ code: "not_in_scope" }, fallback)).toEqual({
      code: "not_in_scope",
      values: { left: 2000, max: 200 },
    });
    expect(sendProblem({ code: "network", details: "nope" }, fallback).values).toEqual(fallback);
  });
});
