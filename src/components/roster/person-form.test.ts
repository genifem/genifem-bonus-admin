import type { Schemas } from "@crewstars/api-client";
import { describe, expect, it } from "vitest";

import { createBody, draftFrom, patchBody, placementOf } from "./person-form";

const maria: Schemas["PersonOut"] = {
  id: "p1",
  eid: "2741001",
  name: "Maria Lopez",
  role: "crew",
  store: { id: "s2741", number: "2741", name: "Main St" },
  stores: [],
  area: { id: "aN", name: "North area" },
  hire_date: "2026-08-29",
  status: "active",
  terminated_at: null,
  language: "es",
  setup_done: true,
  phone_masked: "(•••) •••-4821",
  locked: false,
};

const tina: Schemas["PersonOut"] = {
  ...maria,
  id: "p2",
  eid: "9000201",
  name: "Tina Brooks",
  role: "supervisor",
  store: null,
  stores: [
    { id: "s2741", number: "2741", name: "Main St" },
    { id: "s2815", number: "2815", name: "Market Sq" },
  ],
};

describe("placementOf", () => {
  it("follows the role", () => {
    expect(placementOf("crew")).toBe("store");
    expect(placementOf("shift")).toBe("store");
    expect(placementOf("gm")).toBe("store");
    expect(placementOf("supervisor")).toBe("stores");
    expect(placementOf("director")).toBe("area");
  });
});

describe("draftFrom", () => {
  it("starts someone new as English-speaking crew with nothing filled in", () => {
    expect(draftFrom(null)).toEqual({
      eid: "",
      name: "",
      role: "crew",
      storeId: "",
      storeIds: [],
      areaId: "",
      phone: "",
      removePhone: false,
      hireDate: "",
      language: "en",
    });
  });

  it("fills an edit from the roster, never the phone", () => {
    expect(draftFrom(maria)).toMatchObject({ eid: "2741001", storeId: "s2741", areaId: "aN", phone: "", hireDate: "2026-08-29" });
    expect(draftFrom(tina).storeIds).toEqual(["s2741", "s2815"]);
  });
});

describe("createBody", () => {
  it("sends the store for store roles, and only what was filled in", () => {
    const draft = { ...draftFrom(null), eid: " 2741009 ", name: "  Ava   Ruiz ", storeId: "s2741" };
    expect(createBody(draft)).toEqual({ eid: "2741009", name: "Ava Ruiz", role: "crew", language: "en", store_id: "s2741" });
  });

  it("sends a supervisor's stores, a director's area, a phone and a hire date", () => {
    const supervisor = { ...draftFrom(null), eid: "9000300", name: "Sam", role: "supervisor" as const, storeIds: ["a", "b", "a"] };
    expect(createBody(supervisor)).toMatchObject({ store_ids: ["a", "b"] });
    expect(createBody(supervisor)).not.toHaveProperty("area_id");

    const director = {
      ...draftFrom(null),
      eid: "9000101",
      name: "Rachel",
      role: "director" as const,
      areaId: "aN",
      storeId: "left-over",
      phone: " 555-010-9101 ",
      hireDate: "2022-11-01",
    };
    expect(createBody(director)).toEqual({
      eid: "9000101",
      name: "Rachel",
      role: "director",
      language: "en",
      area_id: "aN",
      phone: "555-010-9101",
      hire_date: "2022-11-01",
    });
  });

  it("leaves a missing placement for the API to refuse by field", () => {
    expect(createBody({ ...draftFrom(null), eid: "X12", name: "N" })).not.toHaveProperty("store_id");
    expect(createBody({ ...draftFrom(null), eid: "X12", name: "N", role: "supervisor" }).store_ids).toEqual([]);
  });
});

describe("patchBody", () => {
  it("is empty when nothing changed", () => {
    expect(patchBody(maria, draftFrom(maria))).toEqual({});
    expect(patchBody(tina, { ...draftFrom(tina), storeIds: ["s2815", "s2741"] })).toEqual({});
  });

  it("treats an Employee ID's case and spaces as the same ID", () => {
    expect(patchBody(maria, { ...draftFrom(maria), eid: " 2741 001 " })).toEqual({});
    expect(patchBody(maria, { ...draftFrom(maria), eid: "2741002" })).toEqual({ eid: "2741002" });
  });

  it("sends the changed fields alone", () => {
    expect(patchBody(maria, { ...draftFrom(maria), name: "Maria  López", language: "en" })).toEqual({
      name: "Maria López",
      language: "en",
    });
    expect(patchBody(maria, { ...draftFrom(maria), hireDate: "" })).toEqual({ hire_date: null });
  });

  it("replaces or removes the phone, and keeps it when left empty", () => {
    expect(patchBody(maria, { ...draftFrom(maria), phone: "(555) 010-1234" })).toEqual({ phone: "(555) 010-1234" });
    expect(patchBody(maria, { ...draftFrom(maria), phone: "555", removePhone: true })).toEqual({ phone: null });
  });

  it("sends a move with the role and the placement that goes with it", () => {
    expect(patchBody(maria, { ...draftFrom(maria), storeId: "s2815" })).toEqual({ role: "crew", store_id: "s2815" });
    expect(patchBody(maria, { ...draftFrom(maria), role: "gm" })).toEqual({ role: "gm", store_id: "s2741" });
  });

  it("lets the API work a supervisor's area out again when their stores change", () => {
    expect(patchBody(tina, { ...draftFrom(tina), storeIds: ["s2741"] })).toEqual({
      role: "supervisor",
      store_ids: ["s2741"],
      area_id: null,
    });
  });

  it("sends a promotion to director with the area", () => {
    expect(patchBody(tina, { ...draftFrom(tina), role: "director", areaId: "aS" })).toEqual({
      role: "director",
      area_id: "aS",
    });
  });
});
