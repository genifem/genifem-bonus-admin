import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { failureOf, FieldSaver, fieldMessage, type SaveStatus } from "./autosave";

/** A send whose answers the test decides, one per call, in order. */
function fakeApi() {
  const calls: Record<string, unknown>[] = [];
  const answers: Array<{ resolve: () => void; reject: (err: unknown) => void }> = [];
  const send = vi.fn((changes: Record<string, unknown>) => {
    calls.push(changes);
    return new Promise<unknown>((resolve, reject) => answers.push({ resolve: () => resolve({}), reject }));
  });
  return { send, calls, answers };
}

const apiError = (status: number, code: string, details?: unknown) =>
  Object.assign(new Error(code), { status, code, details });

function saverFor(path: string, saved: number, send: (c: Record<string, unknown>) => Promise<unknown>) {
  const seen: SaveStatus[] = [];
  const saver = new FieldSaver<number>({
    path,
    saved,
    send,
    onStatus: (status) => seen.push(status),
    delayMs: 600,
    busyRetryMs: 500,
    savedForMs: 2500,
  });
  const last = () => seen[seen.length - 1]?.kind;
  return { saver, seen, last };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("FieldSaver", () => {
  it("waits for a pause, then sends the last value typed as one PATCH of its path", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("allowance.crew", 30, api.send);

    saver.edit({ ok: true, value: 4 });
    await vi.advanceTimersByTimeAsync(300);
    saver.edit({ ok: true, value: 45 });
    await vi.advanceTimersByTimeAsync(300);
    saver.edit({ ok: true, value: 50 });
    expect(last()).toBe("pending");
    await vi.advanceTimersByTimeAsync(599);
    expect(api.send).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(api.calls).toEqual([{ "allowance.crew": 50 }]);
    expect(last()).toBe("saving");

    api.answers[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toBe("saved");
    // "Saved" is quiet: it goes away on its own.
    await vi.advanceTimersByTimeAsync(2500);
    expect(last()).toBe("idle");
  });

  it("sends nothing when the field is back to what the API holds", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("allowance.crew", 30, api.send);
    saver.edit({ ok: true, value: 31 });
    saver.edit({ ok: true, value: 30 });
    expect(last()).toBe("idle");
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.send).not.toHaveBeenCalled();
  });

  it("never sends a value its own check refused, and says why at once", async () => {
    const api = fakeApi();
    const { saver, seen } = saverFor("redeem.max_rewards", 3, api.send);
    saver.edit({ ok: true, value: 5 });
    saver.edit({ ok: false, problem: "range" });
    expect(seen.at(-1)).toEqual({ kind: "invalid", problem: "range" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(api.send).not.toHaveBeenCalled();
  });

  it("saves at once when the field loses focus", async () => {
    const api = fakeApi();
    const { saver } = saverFor("redeem.store_budget", 4000, api.send);
    saver.edit({ ok: true, value: 5000 });
    saver.flush();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toEqual([{ "redeem.store_budget": 5000 }]);
    saver.flush(); // nothing left waiting
    expect(api.send).toHaveBeenCalledTimes(1);
  });

  it("sends what is still waiting when the field goes away", async () => {
    const api = fakeApi();
    const { saver } = saverFor("allowance.gm", 300, api.send);
    saver.edit({ ok: true, value: 350 });
    saver.dispose();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toEqual([{ "allowance.gm": 350 }]);
  });

  it("sends one save at a time, so the last value typed is the one kept", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("allowance.crew", 30, api.send);
    saver.edit({ ok: true, value: 50 });
    await vi.advanceTimersByTimeAsync(600);
    expect(api.calls).toHaveLength(1);

    // Typing again while the first save is out: it waits its turn.
    saver.edit({ ok: true, value: 60 });
    await vi.advanceTimersByTimeAsync(600);
    expect(api.calls).toHaveLength(1);
    expect(last()).toBe("pending");

    // The first answer is for a value since overtaken: it says nothing.
    api.answers[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toEqual([{ "allowance.crew": 50 }, { "allowance.crew": 60 }]);
    expect(last()).toBe("saving");

    api.answers[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toBe("saved");
  });

  it("puts the API back when the owner types the old value while a save is out", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("allowance.crew", 30, api.send);
    saver.edit({ ok: true, value: 50 });
    await vi.advanceTimersByTimeAsync(600);
    saver.edit({ ok: true, value: 30 });
    expect(last()).toBe("pending");
    await vi.advanceTimersByTimeAsync(600);
    api.answers[0]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.calls).toEqual([{ "allowance.crew": 50 }, { "allowance.crew": 30 }]);
  });

  it("names the field from details.fields on a 422, or from the path above it", async () => {
    const api = fakeApi();
    const { saver, seen } = saverFor("amounts.crew.1", 10, api.send);
    saver.edit({ ok: true, value: 0 });
    await vi.advanceTimersByTimeAsync(600);
    api.answers[0]!.reject(
      apiError(422, "settings_invalid", { fields: { "amounts.crew": "each amount must be 1 or more" } }),
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({
      kind: "failed",
      code: "settings_invalid",
      message: "each amount must be 1 or more",
    });
  });

  it("tries a busy save once more, then says so", async () => {
    const api = fakeApi();
    const { saver, seen } = saverFor("upward", 1, api.send);
    saver.edit({ ok: true, value: 0 });
    await vi.advanceTimersByTimeAsync(600);
    api.answers[0]!.reject(apiError(409, "settings_busy"));
    await vi.advanceTimersByTimeAsync(499);
    expect(api.send).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(api.send).toHaveBeenCalledTimes(2);
    api.answers[1]!.reject(apiError(409, "settings_busy"));
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ kind: "failed", code: "settings_busy", message: null });
    expect(api.send).toHaveBeenCalledTimes(2);
  });

  it("lands a busy save on its second try", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("upward", 1, api.send);
    saver.edit({ ok: true, value: 0 });
    await vi.advanceTimersByTimeAsync(600);
    api.answers[0]!.reject(apiError(409, "settings_busy"));
    await vi.advanceTimersByTimeAsync(500);
    api.answers[1]!.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(last()).toBe("saved");
  });

  it("says a lost connection, and keeps the old baseline so the next edit saves again", async () => {
    const api = fakeApi();
    const { saver, seen } = saverFor("allowance.crew", 30, api.send);
    saver.edit({ ok: true, value: 50 });
    await vi.advanceTimersByTimeAsync(600);
    api.answers[0]!.reject(new TypeError("fetch failed"));
    await vi.advanceTimersByTimeAsync(0);
    expect(seen.at(-1)).toEqual({ kind: "failed", code: "network", message: null });

    saver.edit({ ok: true, value: 50 });
    await vi.advanceTimersByTimeAsync(600);
    expect(api.calls).toEqual([{ "allowance.crew": 50 }, { "allowance.crew": 50 }]);
  });

  it("takes a new baseline from the page only while nothing is waiting", async () => {
    const api = fakeApi();
    const { saver, last } = saverFor("allowance.crew", 30, api.send);
    saver.rebase(40);
    saver.edit({ ok: true, value: 40 });
    expect(last()).toBe("idle");

    saver.edit({ ok: true, value: 45 });
    saver.rebase(99); // ignored: 45 is waiting
    await vi.advanceTimersByTimeAsync(600);
    expect(api.calls).toEqual([{ "allowance.crew": 45 }]);
  });
});

describe("fieldMessage", () => {
  const details = { fields: { "allowance.crew": "must be 0 or more", "amounts.gm": "needs exactly 3 amounts" } };

  it("finds the path, or the nearest one above it", () => {
    expect(fieldMessage(details, "allowance.crew")).toBe("must be 0 or more");
    expect(fieldMessage(details, "amounts.gm.2")).toBe("needs exactly 3 amounts");
  });

  it("is null for a field the API did not name, or no details at all", () => {
    expect(fieldMessage(details, "allowance.gm")).toBeNull();
    expect(fieldMessage(details, "amounts")).toBeNull();
    expect(fieldMessage(undefined, "upward")).toBeNull();
    expect(fieldMessage({ fields: ["x"] }, "upward")).toBeNull();
  });
});

describe("failureOf", () => {
  it("keeps the API's status, code and details", () => {
    expect(failureOf(apiError(409, "settings_busy", { a: 1 }))).toEqual({
      status: 409,
      code: "settings_busy",
      details: { a: 1 },
    });
  });

  it("calls anything else a network failure", () => {
    expect(failureOf(new TypeError("fetch failed"))).toEqual({ status: 0, code: "network" });
    expect(failureOf("nope")).toEqual({ status: 0, code: "network" });
  });
});
