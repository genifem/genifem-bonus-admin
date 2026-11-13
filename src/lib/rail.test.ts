import { describe, expect, it } from "vitest";

import { nextRail, RAIL_COOKIE, railCookie, railState } from "./rail";

describe("railState", () => {
  it("reads the two choices an owner can make", () => {
    expect(railState("expanded")).toBe("expanded");
    expect(railState("collapsed")).toBe("collapsed");
  });

  it("leaves it to the screen's width when no choice was made, or one it does not know", () => {
    expect(railState(undefined)).toBe("auto");
    expect(railState(null)).toBe("auto");
    expect(railState("")).toBe("auto");
    expect(railState("auto")).toBe("auto");
    expect(railState("Collapsed")).toBe("auto");
    expect(railState(" collapsed")).toBe("auto");
    expect(railState("open")).toBe("auto");
  });
});

describe("nextRail", () => {
  it("opens a folded rail and folds an open one", () => {
    expect(nextRail(true)).toBe("expanded");
    expect(nextRail(false)).toBe("collapsed");
  });
});

describe("railCookie", () => {
  it("remembers the choice for the whole portal, for a year", () => {
    expect(railCookie("collapsed")).toBe(`${RAIL_COOKIE}=collapsed; path=/; max-age=31536000; samesite=lax`);
    expect(railCookie("expanded")).toMatch(/^cs_rail=expanded; path=\/;/);
  });

  it("writes a value railState reads back", () => {
    for (const choice of ["expanded", "collapsed"] as const) {
      const value = railCookie(choice).split(";")[0]!.split("=")[1];
      expect(railState(value)).toBe(choice);
    }
  });
});
