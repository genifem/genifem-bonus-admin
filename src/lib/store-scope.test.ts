import { describe, expect, it } from "vitest";

import { findStore, hrefWithStore, isScopedPath, storeHref, storeParam } from "./store-scope";

const STORES = [
  { id: "6af58bb8c176266fac49d587", number: "2741" },
  { id: "6af58bb8c176266fac49d588", number: "2815" },
  { id: "6af58bb8c176266fac49d5ab", number: "AB-1" },
];

describe("storeParam", () => {
  it("reads the store as written, and nothing for all stores", () => {
    expect(storeParam({ store: "2741" })).toBe("2741");
    expect(storeParam({ store: " 2815 " })).toBe("2815");
    expect(storeParam({})).toBeUndefined();
    expect(storeParam({ store: "" })).toBeUndefined();
    expect(storeParam({ store: "   " })).toBeUndefined();
    expect(storeParam({ store: ["2741", "2815"] })).toBeUndefined();
  });

  it("does not carry an absurdly long value through", () => {
    expect(storeParam({ store: "9".repeat(200) })).toHaveLength(40);
  });
});

describe("findStore", () => {
  it("finds a store by its number, whatever its case", () => {
    expect(findStore("2815", STORES)?.id).toBe("6af58bb8c176266fac49d588");
    expect(findStore("ab-1", STORES)?.number).toBe("AB-1");
  });

  it("also takes the API's id", () => {
    expect(findStore("6af58bb8c176266fac49d587", STORES)?.number).toBe("2741");
  });

  it("is undefined for all stores and for a store nobody has", () => {
    expect(findStore(undefined, STORES)).toBeUndefined();
    expect(findStore("9999", STORES)).toBeUndefined();
  });
});

describe("isScopedPath", () => {
  it("is the pages the shared filter belongs to (OP-01)", () => {
    for (const path of ["/", "/people", "/redemptions", "/awards", "/people/"]) {
      expect(isScopedPath(path), path).toBe(true);
    }
    for (const path of ["/recognize", "/roster", "/rewards", "/audit", "/peoples"]) {
      expect(isScopedPath(path), path).toBe(false);
    }
  });
});

describe("hrefWithStore", () => {
  it("adds, replaces and drops the store, keeping the rest of the link", () => {
    expect(hrefWithStore("/people", "2741")).toBe("/people?store=2741");
    expect(hrefWithStore("/", "2741")).toBe("/?store=2741");
    expect(hrefWithStore("/people?role=gm&store=2815", "2741")).toBe("/people?role=gm&store=2741");
    expect(hrefWithStore("/people?role=gm&store=2815", null)).toBe("/people?role=gm");
    expect(hrefWithStore("/redemptions#top", "AB-1")).toBe("/redemptions?store=AB-1#top");
    expect(hrefWithStore("/", undefined)).toBe("/");
  });
});

describe("storeHref", () => {
  it("filters the page to a store and starts its list again from the top", () => {
    expect(storeHref("/people", { role: "crew", offset: "50" }, "2741")).toBe("/people?role=crew&store=2741");
    expect(storeHref("/", { store: "2741" }, null)).toBe("/");
  });
});
