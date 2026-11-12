import { describe, expect, it } from "vitest";

import {
  AUDIT_PAGE_SIZE,
  auditApiQuery,
  auditPath,
  auditState,
  everyoneHref,
  historyHref,
  kindHref,
} from "./audit-query";

const ROSA = "6af58e46b918adf0fafcb684";
const CURSOR = "6af5b8233de6d45b01bb3eeb";

describe("auditState", () => {
  it("reads the kind and the record", () => {
    expect(auditState({ kind: "roster", target: ROSA })).toEqual({ kind: "roster", target: ROSA });
  });

  it("leaves out what the API would refuse rather than sending it", () => {
    expect(auditState({ kind: "everything", target: "not-an-id" })).toEqual({ kind: null, target: null });
    expect(auditState({ kind: ["roster", "awards"], target: "" })).toEqual({ kind: null, target: null });
  });

  it("takes an id in either case", () => {
    expect(auditState({ target: ROSA.toUpperCase() }).target).toBe(ROSA);
  });
});

describe("the API query", () => {
  it("asks for a page, filtered", () => {
    expect(auditApiQuery({ kind: "settings", target: null })).toEqual({ limit: AUDIT_PAGE_SIZE, kind: "settings" });
    expect(auditApiQuery({ kind: null, target: ROSA }, CURSOR)).toEqual({
      limit: AUDIT_PAGE_SIZE,
      target_id: ROSA,
      before: CURSOR,
    });
  });

  it("is a path under the BFF for Load more", () => {
    expect(auditPath({ kind: "sign_in", target: ROSA }, CURSOR, 20)).toBe(
      `/portal/audit?limit=20&kind=sign_in&target_id=${ROSA}&before=${CURSOR}`,
    );
    expect(auditPath({ kind: null, target: null })).toBe(`/portal/audit?limit=${AUDIT_PAGE_SIZE}`);
  });
});

describe("links", () => {
  it("swaps the kind and keeps one record's history", () => {
    expect(kindHref({ target: ROSA, kind: "roster" }, "awards")).toBe(`/audit?target=${ROSA}&kind=awards`);
    expect(kindHref({ kind: "roster" }, null)).toBe("/audit");
  });

  it("goes back to everyone's changes, keeping the kind", () => {
    expect(everyoneHref({ target: ROSA, kind: "roster" })).toBe("/audit?kind=roster");
  });

  it("opens one record's history", () => {
    expect(historyHref(ROSA)).toBe(`/audit?target=${ROSA}`);
  });
});
