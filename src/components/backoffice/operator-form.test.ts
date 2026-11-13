import { describe, expect, it } from "vitest";

import {
  actionHref,
  auditApiQuery,
  auditState,
  newestHref,
  olderHref,
} from "./audit-query";
import {
  checkOperator,
  fieldsOfRefusal,
  operatorBody,
  timeZoneChoices,
  TIME_ZONES,
  type OperatorDraft,
} from "./operator-form";

const draft = (changes: Partial<OperatorDraft> = {}): OperatorDraft => ({
  name: "Acme Burgers",
  slug: "acme",
  tz: "America/Chicago",
  ownerName: "Grant Ellis",
  ownerEmail: "grant@example.com",
  ownerLanguage: "en",
  ...changes,
});

describe("checkOperator", () => {
  it("passes a complete operator", () => {
    expect(checkOperator(draft())).toEqual([]);
  });

  it("names every field that is wrong", () => {
    expect(
      checkOperator(draft({ name: " ", slug: "admin", ownerName: "", ownerEmail: "grant@" })).map(
        (problem) => `${problem.field}:${problem.problem}`,
      ),
    ).toEqual(["name:required", "slug:reserved", "ownerName:required", "ownerEmail:invalid"]);
    expect(checkOperator(draft({ name: "x".repeat(101) }))[0]).toEqual({ field: "name", problem: "tooLong" });
  });
});

describe("operatorBody", () => {
  it("is OperatorCreateIn, trimmed, with the reason", () => {
    expect(operatorBody(draft({ name: " Acme ", ownerEmail: " grant@example.com " }), "New customer")).toEqual({
      name: "Acme",
      slug: "acme",
      tz: "America/Chicago",
      owner: { name: "Grant Ellis", email: "grant@example.com", language: "en" },
      reason: "New customer",
    });
  });
});

describe("fieldsOfRefusal", () => {
  it("puts a taken or reserved address back beside it", () => {
    expect(fieldsOfRefusal("slug_taken", undefined)).toEqual({ slug: "taken" });
    expect(fieldsOfRefusal("slug_reserved", undefined)).toEqual({ slug: "reserved" });
  });

  it("maps the schema's field paths to the form's fields", () => {
    expect(
      fieldsOfRefusal("validation_failed", { fields: { "owner.email": "value is not a valid email", tz: "unknown" } }),
    ).toEqual({ ownerEmail: "invalid", tz: "invalid" });
  });

  it("leaves anything else to the dialog", () => {
    expect(fieldsOfRefusal("validation_failed", { fields: { request: "bad" } })).toBeNull();
    expect(fieldsOfRefusal("platform_permission_missing", { missing: ["operators.write"] })).toBeNull();
  });
});

describe("timeZoneChoices", () => {
  it("offers the US zones, with the operator's own first when it is another", () => {
    expect(timeZoneChoices("en").map((zone) => zone.value)).toEqual([...TIME_ZONES]);
    const withOwn = timeZoneChoices("en", "Europe/Madrid");
    expect(withOwn[0]!.value).toBe("Europe/Madrid");
    expect(withOwn).toHaveLength(TIME_ZONES.length + 1);
    expect(withOwn[1]!.label).toContain("America/New_York");
  });
});

describe("the audit log's URL", () => {
  const id = "65f1a2b3c4d5e6f7a8b9c0d1";

  it("keeps only what the API would take", () => {
    expect(auditState({ operator: id, actor: "nope", action: "owner.", before: id.toUpperCase() })).toEqual({
      operator: id,
      actor: null,
      action: "owner.",
      before: id,
    });
    expect(auditState({ action: "everything." }).action).toBeNull();
  });

  it("asks the API with the filters and the cursor", () => {
    expect(auditApiQuery({ operator: id, actor: null, action: "staff.", before: null })).toEqual({
      limit: 40,
      operator_id: id,
      action: "staff.",
    });
  });

  it("starts a new filter from the newest, and pages with the cursor", () => {
    expect(actionHref({ operator: id, before: id }, "auth.")).toBe(`/audit?operator=${id}&action=auth.`);
    expect(olderHref({ action: "owner." }, id)).toBe(`/audit?action=owner.&before=${id}`);
    expect(newestHref({ action: "owner.", before: id })).toBe("/audit?action=owner.");
  });
});
