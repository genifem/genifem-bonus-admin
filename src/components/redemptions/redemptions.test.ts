import { describe, expect, it } from "vitest";

import {
  defaultPayrollMonth,
  isMonthKey,
  monthKeyOf,
  monthStart,
  payrollFileName,
  payrollPath,
  recentMonths,
  shiftMonth,
} from "./payroll";
import {
  actionsFor,
  deciderOf,
  redemptionsApiQuery,
  redemptionsState,
  tabHasActions,
  tabHref,
} from "./redemptions-query";

describe("redemptionsState", () => {
  it("starts on Waiting, and reads a known tab", () => {
    expect(redemptionsState({})).toEqual({ tab: "pending", offset: 0 });
    expect(redemptionsState({ status: "approved" }).tab).toBe("approved");
    expect(redemptionsState({ status: "all" }).tab).toBe("all");
    expect(redemptionsState({ status: "cancelled" }).tab).toBe("pending");
    expect(redemptionsState({ status: ["approved", "all"] }).tab).toBe("pending");
  });

  it("snaps the offset to a page", () => {
    expect(redemptionsState({ offset: "30" }).offset).toBe(25);
    expect(redemptionsState({ offset: "-5" }).offset).toBe(0);
    expect(redemptionsState({ offset: "x" }).offset).toBe(0);
  });
});

describe("redemptionsApiQuery", () => {
  it("turns the offset into a page and adds the store's id", () => {
    expect(redemptionsApiQuery({ tab: "pending", offset: 0 })).toEqual({ status: "pending", page: 1, page_size: 25 });
    expect(redemptionsApiQuery({ tab: "all", offset: 50 }, "6af58bb8c176266fac49d587")).toEqual({
      status: "all",
      page: 3,
      page_size: 25,
      store: "6af58bb8c176266fac49d587",
    });
  });
});

describe("tabHref", () => {
  it("keeps the store, starts the list again and leaves the default tab out", () => {
    expect(tabHref({ store: "2741", status: "all", offset: "25" }, "approved")).toBe(
      "/redemptions?store=2741&status=approved",
    );
    expect(tabHref({ store: "2741", status: "all" }, "pending")).toBe("/redemptions?store=2741");
    expect(tabHref({}, "declined")).toBe("/redemptions?status=declined");
  });
});

describe("deciderOf", () => {
  it("says who decided: a manager, an owner, or nobody when approval was off", () => {
    expect(deciderOf({ decided_by: null })).toBeNull();
    expect(deciderOf({ decided_by: { kind: "system", name: null } })).toEqual({ kind: "automatic" });
    expect(deciderOf({ decided_by: { kind: "owner", name: "Grant Ellis" } })).toEqual({
      kind: "owner",
      name: "Grant Ellis",
    });
    expect(deciderOf({ decided_by: { kind: "person", name: "Monica Diaz" } })).toEqual({
      kind: "manager",
      name: "Monica Diaz",
    });
    expect(deciderOf({ decided_by: { kind: "person", name: null } })).toEqual({ kind: "manager", name: null });
  });
});

describe("actionsFor", () => {
  it("offers approve and decline while it waits, collect once approved, and nothing after", () => {
    expect(actionsFor("pending")).toEqual(["decline", "approve"]);
    expect(actionsFor("approved")).toEqual(["collect"]);
    expect(actionsFor("collected")).toEqual([]);
    expect(actionsFor("declined")).toEqual([]);
    expect(actionsFor("cancelled")).toEqual([]);
    expect(tabHasActions("declined")).toBe(false);
    expect(tabHasActions("all")).toBe(true);
  });
});

describe("payroll months", () => {
  it("knows a month key when it sees one", () => {
    expect(isMonthKey("2026-11")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(isMonthKey("2026-1")).toBe(false);
    expect(isMonthKey(202611)).toBe(false);
  });

  it("reads the month in a time zone", () => {
    const lateOnOct31InChicago = new Date("2026-11-01T03:30:00Z");
    expect(monthKeyOf(lateOnOct31InChicago, "UTC")).toBe("2026-11");
    expect(monthKeyOf(lateOnOct31InChicago, "America/Chicago")).toBe("2026-10");
  });

  it("steps across years", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-11", -23)).toBe("2024-12");
    expect(() => shiftMonth("nope", 1)).toThrow();
  });

  it("offers this month and the eleven before it, newest first", () => {
    const months = recentMonths("2026-02");
    expect(months).toHaveLength(12);
    expect(months.slice(0, 3)).toEqual(["2026-02", "2026-01", "2025-12"]);
    expect(months.at(-1)).toBe("2025-03");
    expect(recentMonths("2026-02", 0)).toEqual(["2026-02"]);
  });

  it("names a month by its first day in UTC", () => {
    expect(monthStart("2026-11").toISOString()).toBe("2026-11-01T00:00:00.000Z");
  });

  it("starts on the API's month, else the date's", () => {
    expect(defaultPayrollMonth(["2026-10", "2026-11"], new Date("2026-11-12T12:00:00Z"))).toBe("2026-10");
    expect(defaultPayrollMonth([], new Date("2026-11-12T12:00:00Z"))).toBe("2026-11");
    expect(defaultPayrollMonth(["bad"], new Date("2026-11-12T12:00:00Z"))).toBe("2026-11");
  });

  it("asks the API for one month, and never for anything else", () => {
    expect(payrollPath("2026-11")).toBe("/portal/redemptions/payroll.csv?month=2026-11");
    expect(() => payrollPath("2026-11&x=1")).toThrow();
  });

  it("saves under the API's file name, cleaned, or one of its own", () => {
    expect(payrollFileName("2026-11", 'attachment; filename="crew-stars-payroll-2026-11.csv"')).toBe(
      "crew-stars-payroll-2026-11.csv",
    );
    expect(payrollFileName("2026-11", "attachment; filename=../../x.csv")).toBe("....x.csv");
    expect(payrollFileName("2026-10", null)).toBe("crew-stars-payroll-2026-10.csv");
    expect(payrollFileName("2026-10", "attachment")).toBe("crew-stars-payroll-2026-10.csv");
  });
});
