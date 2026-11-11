import { describe, expect, it } from "vitest";

import { describeFailure, placeProblems } from "./api-errors";

describe("describeFailure", () => {
  it("uses the field the API names on a 422", () => {
    expect(describeFailure({ status: 422, code: "phone_invalid", details: { field: "phone" } })).toEqual([
      { field: "phone", code: "phone_invalid", values: {} },
    ]);
    expect(describeFailure({ status: 422, code: "stores_required", details: { field: "store_ids" } })).toEqual([
      { field: "store_ids", code: "stores_required", values: {} },
    ]);
  });

  it("puts a clash next to the field it is about, with who holds the place", () => {
    expect(describeFailure({ status: 409, code: "store_has_gm", details: { name: "Monica Diaz" } })).toEqual([
      { field: "store_id", code: "store_has_gm", values: { name: "Monica Diaz" } },
    ]);
    expect(describeFailure({ status: 409, code: "store_has_supervisor", details: { name: "Tina" } })[0]?.field).toBe(
      "store_ids",
    );
    expect(describeFailure({ status: 409, code: "area_has_director", details: { name: "Rachel" } })[0]?.field).toBe(
      "area_id",
    );
    expect(describeFailure({ status: 409, code: "eid_taken" })[0]?.field).toBe("eid");
    expect(describeFailure({ status: 409, code: "store_number_taken" })[0]?.field).toBe("number");
    expect(describeFailure({ status: 409, code: "area_name_taken" })[0]?.field).toBe("name");
  });

  it("carries how many people still work at a store being closed", () => {
    expect(describeFailure({ status: 409, code: "store_has_people", details: { people: 3 } })).toEqual([
      { field: "active", code: "store_has_people", values: { people: 3 } },
    ]);
  });

  it("leaves anything else to the form as a whole", () => {
    expect(describeFailure({ status: 500, code: "http_500" })).toEqual([
      { field: null, code: "http_500", values: {} },
    ]);
    expect(describeFailure({ status: 0, code: "network", details: "odd" })).toEqual([
      { field: null, code: "network", values: {} },
    ]);
  });

  it("gives each field the schema refused a problem of its own", () => {
    const details = {
      fields: {
        eid: "an Employee ID is 3-20 letters or digits",
        "store_ids.0": "bad id",
        "store_ids.2": "bad id",
        request: "the body is not JSON",
      },
    };
    expect(describeFailure({ status: 422, code: "validation_failed", details })).toEqual([
      { field: "eid", code: "validation_failed", values: {} },
      { field: "store_ids", code: "validation_failed", values: {} },
      { field: null, code: "validation_failed", values: {} },
    ]);
  });

  it("still says something when a refusal names no field", () => {
    expect(describeFailure({ status: 422, code: "validation_failed", details: { fields: {} } })).toEqual([
      { field: null, code: "validation_failed", values: {} },
    ]);
    expect(describeFailure({ status: 422, code: "validation_failed" })).toEqual([
      { field: null, code: "validation_failed", values: {} },
    ]);
  });
});

describe("placeProblems", () => {
  it("puts problems on the fields the form shows and the rest in the alert", () => {
    const { byField, general } = placeProblems(
      [
        { field: "eid", code: "eid_taken", values: {} },
        { field: "store_id", code: "store_has_gm", values: { name: "Monica" } },
        { field: null, code: "generic", values: {} },
      ],
      ["eid", "name", "area_id"],
    );
    expect(Object.keys(byField)).toEqual(["eid"]);
    expect(general.map((problem) => problem.code)).toEqual(["store_has_gm", "generic"]);
  });

  it("keeps the first problem for a field", () => {
    const { byField, general } = placeProblems(
      [
        { field: "eid", code: "validation_failed", values: {} },
        { field: "eid", code: "eid_taken", values: {} },
      ],
      ["eid"],
    );
    expect(byField.eid?.code).toBe("validation_failed");
    expect(general).toHaveLength(1);
  });
});
