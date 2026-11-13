import { describe, expect, it } from "vitest";

import { safeNext } from "./session-paths";

describe("safeNext", () => {
  it("keeps a path on this site, with its query and fragment", () => {
    expect(safeNext("/redemptions?status=pending")).toBe("/redemptions?status=pending");
    expect(safeNext("/audit#top")).toBe("/audit#top");
    expect(safeNext("/operators/abc")).toBe("/operators/abc");
  });

  it("falls back to the overview for nothing at all", () => {
    expect(safeNext(null)).toBe("/");
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext("")).toBe("/");
  });

  it("never sends anyone to another site", () => {
    for (const evil of [
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      // P6 security review: browsers drop tab, CR and LF inside a URL, so these were
      // "//evil.example" by the time the browser followed them.
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
      "\t//evil.example",
      "javascript:alert(1)",
      "evil.example/path",
    ]) {
      expect(safeNext(evil)).toBe("/");
    }
  });
});
