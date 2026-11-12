import { describe, expect, it } from "vitest";

import {
  activeFilter,
  candidatesApiQuery,
  filterForRole,
  recognizeState,
  teamApiQuery,
  teamFilters,
} from "./recognition-query";

const ANA = "6af58bb8c176266fac49d596";

describe("recognizeState", () => {
  it("reads the filter, store, search and person", () => {
    expect(recognizeState({ filter: "crew", store: " 2741 ", q: "  ana ", to: ANA })).toEqual({
      filter: "crew",
      store: "2741",
      q: "ana",
      to: ANA,
    });
  });

  it("ignores what it does not know rather than refusing it", () => {
    expect(recognizeState({ filter: "owners", to: "not-an-id", q: "   " })).toEqual({
      filter: undefined,
      store: undefined,
      q: undefined,
      to: undefined,
    });
  });

  it("keeps a search within the API's limit", () => {
    expect(recognizeState({ q: "x".repeat(120) }).q).toHaveLength(80);
  });
});

describe("the role filter (OP-06)", () => {
  it("defaults to Leaders", () => {
    expect(activeFilter({})).toBe("leaders");
  });

  it("lists the person being recognized when the URL asks for no filter", () => {
    expect(filterForRole("director")).toBe("leaders");
    expect(filterForRole("supervisor")).toBe("leaders");
    expect(filterForRole("gm")).toBe("leaders");
    expect(filterForRole("shift")).toBe("shift");
    expect(filterForRole("crew")).toBe("crew");
    expect(activeFilter({ to: ANA }, "crew")).toBe("crew");
  });

  it("keeps the filter the URL asks for", () => {
    expect(activeFilter({ filter: "everyone", to: ANA }, "crew")).toBe("everyone");
  });
});

describe("candidatesApiQuery", () => {
  it("sends only what is set", () => {
    expect(candidatesApiQuery("leaders")).toEqual({ filter: "leaders" });
    expect(candidatesApiQuery("crew", "s1", "ana")).toEqual({ filter: "crew", store: "s1", q: "ana" });
  });
});

describe("teamFilters and teamApiQuery (OP-08)", () => {
  it("reads the role, search and page", () => {
    expect(teamFilters({ role: "gm", q: " lopez ", offset: "50" })).toEqual({ role: "gm", q: "lopez", offset: 50 });
    expect(teamFilters({ role: "owner", offset: "-3" })).toEqual({ role: undefined, q: undefined, offset: 0 });
  });

  it("keeps the offset on a page boundary", () => {
    expect(teamFilters({ offset: "37" }).offset).toBe(25);
  });

  it("turns the offset into the API's page and adds the store's id", () => {
    expect(teamApiQuery({ offset: 50, role: "crew" }, "s2741")).toEqual({
      page: 3,
      page_size: 25,
      store: "s2741",
      role: "crew",
    });
    expect(teamApiQuery({ offset: 0 })).toEqual({ page: 1, page_size: 25 });
  });
});
