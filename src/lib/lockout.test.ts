import { describe, expect, it } from "vitest";

import { lockMinutes, minutesUntil } from "./lockout";

const NOW = Date.parse("2026-11-11T12:00:00Z");

describe("minutesUntil", () => {
  it("rounds what is left up to whole minutes", () => {
    expect(minutesUntil("2026-11-11T12:15:00+00:00", NOW)).toBe(15);
    expect(minutesUntil("2026-11-11T12:14:01Z", NOW)).toBe(15);
    expect(minutesUntil("2026-11-11T12:00:30Z", NOW)).toBe(1);
  });

  it("never says zero: the API has just said the account is locked", () => {
    expect(minutesUntil("2026-11-11T12:00:00Z", NOW)).toBe(1);
    expect(minutesUntil("2026-11-11T11:59:00Z", NOW)).toBe(1);
  });

  it("reads a time with no offset as UTC", () => {
    expect(minutesUntil("2026-11-11T12:10:00", NOW)).toBe(10);
  });

  it("reads other offsets", () => {
    expect(minutesUntil("2026-11-11T07:05:00-05:00", NOW)).toBe(5);
  });

  it("is null when there is no time to read", () => {
    expect(minutesUntil(null, NOW)).toBeNull();
    expect(minutesUntil(undefined, NOW)).toBeNull();
    expect(minutesUntil("", NOW)).toBeNull();
    expect(minutesUntil("soon", NOW)).toBeNull();
    expect(minutesUntil(1234, NOW)).toBeNull();
  });
});

describe("lockMinutes", () => {
  it("prefers the server's count of seconds left", () => {
    expect(lockMinutes({ until: "2026-11-11T12:15:00Z", retry_after_s: 125 }, NOW)).toBe(3);
    expect(lockMinutes({ retry_after_s: 900 }, NOW)).toBe(15);
    expect(lockMinutes({ retry_after_s: 0 }, NOW)).toBe(1);
  });

  it("falls back to until when there is no count", () => {
    expect(lockMinutes({ until: "2026-11-11T12:15:00Z" }, NOW)).toBe(15);
    expect(lockMinutes({ until: "2026-11-11T12:15:00Z", retry_after_s: "soon" }, NOW)).toBe(15);
  });

  it("is null when the details say neither", () => {
    expect(lockMinutes(undefined, NOW)).toBeNull();
    expect(lockMinutes("nope", NOW)).toBeNull();
    expect(lockMinutes({ until: null }, NOW)).toBeNull();
    expect(lockMinutes({ retry_after_s: -5 }, NOW)).toBeNull();
  });
});
