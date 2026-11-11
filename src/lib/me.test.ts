import { describe, expect, it, vi } from "vitest";

// me.ts reads the API on the server; only its pure part is under test here.
vi.mock("@/lib/server-api", () => ({ serverApi: vi.fn() }));

const { ownerFrom } = await import("./me");

describe("ownerFrom", () => {
  it("uses the name and first name GET /me sends", () => {
    expect(ownerFrom({ name: "Grant Ellis", first_name: "Grant" })).toEqual({ name: "Grant Ellis", firstName: "Grant" });
  });

  it("falls back to the name's first word", () => {
    expect(ownerFrom({ name: "  Kyle   Moreno ", first_name: " " })).toEqual({ name: "Kyle Moreno", firstName: "Kyle" });
  });

  it("is null without a name", () => {
    expect(ownerFrom({ name: "   ", first_name: "" })).toBeNull();
  });
});
