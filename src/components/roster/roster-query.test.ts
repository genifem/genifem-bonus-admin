import { describe, expect, it } from "vitest";

import { lastPageOffset, peopleApiQuery, peopleFilters, rosterTab } from "./roster-query";

const STORES = [
  { id: "s2741", number: "2741" },
  { id: "s2815", number: "2815" },
  { id: "sAB", number: "AB-1" },
];

describe("rosterTab", () => {
  it("reads the tab, defaulting to People", () => {
    expect(rosterTab({})).toBe("people");
    expect(rosterTab({ tab: "stores" })).toBe("stores");
    expect(rosterTab({ tab: "import" })).toBe("import");
    expect(rosterTab({ tab: "settings" })).toBe("people");
    expect(rosterTab({ tab: ["areas", "stores"] })).toBe("people");
  });
});

describe("peopleFilters", () => {
  it("defaults to active people from the first row", () => {
    expect(peopleFilters({})).toEqual({
      role: undefined,
      store: undefined,
      status: "active",
      q: undefined,
      offset: 0,
    });
  });

  it("reads each filter and ignores what it does not know", () => {
    expect(
      peopleFilters({ role: "gm", store: " 2741 ", status: "all", q: "  maria ", offset: "50" }),
    ).toEqual({ role: "gm", store: "2741", status: "all", q: "maria", offset: 50 });
    expect(peopleFilters({ role: "owner", status: "gone", q: "   " })).toMatchObject({
      role: undefined,
      status: "active",
      q: undefined,
    });
  });

  it("keeps the offset on a page boundary and the search within the API's limit", () => {
    expect(peopleFilters({ offset: "37" }).offset).toBe(25);
    expect(peopleFilters({ offset: "-5" }).offset).toBe(0);
    expect(peopleFilters({ q: "x".repeat(120) }).q).toHaveLength(80);
  });
});

describe("peopleApiQuery", () => {
  it("turns the URL's store number into the API's store id, and the offset into a page", () => {
    expect(peopleApiQuery({ store: "2815", status: "active", offset: 50 }, STORES)).toEqual({
      store: "s2815",
      status: "active",
      page: 3,
      page_size: 25,
    });
  });

  it("matches a store number whatever its case", () => {
    expect(peopleApiQuery({ store: "ab-1", status: "all", offset: 0 }, STORES).store).toBe("sAB");
  });

  it("drops a store number nobody has rather than filtering everything out", () => {
    expect(peopleApiQuery({ store: "9999", status: "active", offset: 0 }, STORES)).not.toHaveProperty("store");
  });

  it("sends only the filters that are on", () => {
    expect(peopleApiQuery({ role: "crew", q: "lopez", status: "terminated", offset: 0 }, STORES)).toEqual({
      role: "crew",
      q: "lopez",
      status: "terminated",
      page: 1,
      page_size: 25,
    });
  });
});

describe("lastPageOffset", () => {
  it("is null while the page has rows", () => {
    expect(lastPageOffset(0, 0)).toBeNull();
    expect(lastPageOffset(0, 10)).toBeNull();
    expect(lastPageOffset(25, 26)).toBeNull();
  });

  it("points past-the-end pages at the last one", () => {
    expect(lastPageOffset(50, 26)).toBe(25);
    expect(lastPageOffset(25, 25)).toBe(0);
    expect(lastPageOffset(100, 3)).toBe(0);
  });
});
