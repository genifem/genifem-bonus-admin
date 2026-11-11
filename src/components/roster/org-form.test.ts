import type { Schemas } from "@crewstars/api-client";
import { describe, expect, it } from "vitest";

import { areaCreateBody, areaDraft, areaPatchBody, storeCreateBody, storeDraft, storePatchBody } from "./org-form";

const store: Schemas["StoreOut"] = {
  id: "s2741",
  number: "2741",
  name: "Main St",
  area: { id: "aN", name: "North area" },
  tz: "America/New_York",
  active: true,
  gm: null,
  supervisor: null,
  people: 7,
};

const area: Schemas["AreaOut"] = { id: "aN", name: "North area", tz: null, director: null, stores: 2 };

describe("stores", () => {
  it("creates with only what was filled in", () => {
    expect(storeCreateBody({ ...storeDraft(null), number: " 2900 ", name: " Lake  Rd " })).toEqual({
      number: "2900",
      name: "Lake Rd",
    });
    expect(storeCreateBody({ ...storeDraft(null), number: "2900", name: "Lake Rd", areaId: "aS", tz: "America/Chicago" })).toEqual({
      number: "2900",
      name: "Lake Rd",
      area_id: "aS",
      tz: "America/Chicago",
    });
  });

  it("patches only what changed, with null to clear the area or the time zone", () => {
    expect(storePatchBody(store, storeDraft(store))).toEqual({});
    expect(storePatchBody(store, { ...storeDraft(store), areaId: "", tz: "" })).toEqual({ area_id: null, tz: null });
    expect(storePatchBody(store, { ...storeDraft(store), active: false, name: "Main Street" })).toEqual({
      active: false,
      name: "Main Street",
    });
  });
});

describe("areas", () => {
  it("creates and patches", () => {
    expect(areaCreateBody({ name: " West ", tz: "" })).toEqual({ name: "West" });
    expect(areaCreateBody({ name: "West", tz: "America/Denver" })).toEqual({ name: "West", tz: "America/Denver" });
    expect(areaPatchBody(area, areaDraft(area))).toEqual({});
    expect(areaPatchBody(area, { name: "North", tz: "America/New_York" })).toEqual({
      name: "North",
      tz: "America/New_York",
    });
  });
});
