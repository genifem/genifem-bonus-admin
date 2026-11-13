import { describe, expect, it } from "vitest";

import type { PlatformPermission } from "@/lib/platform";

import { ownerActions, ownerPermissionsOf, type OwnerPermissions } from "./owner-actions";

// What GET /platform/me sends for each role (bonus-backend permissions.py).
const SUPER_ADMIN: readonly PlatformPermission[] = [
  "audit.read",
  "health.read",
  "operators.read",
  "operators.write",
  "overview.read",
  "owners.invite",
  "owners.manage",
  "owners.mfa_reset",
  "owners.resend",
  "staff.read",
  "staff.write",
];
const SUPPORT: readonly PlatformPermission[] = [
  "audit.read",
  "health.read",
  "operators.read",
  "overview.read",
  "owners.mfa_reset",
  "owners.resend",
];

const invited = { invited: true, status: "active", mfa_enabled: false } as const;
const joined = { invited: false, status: "active", mfa_enabled: true } as const;
const suspended = { invited: false, status: "disabled", mfa_enabled: false } as const;

describe("ownerPermissionsOf", () => {
  it("gives a super admin every owner action", () => {
    expect(ownerPermissionsOf(SUPER_ADMIN)).toEqual({ add: true, resend: true, mfaReset: true, manage: true });
  });

  it("lets support resend an invite and reset an authenticator, but never add an owner (P6)", () => {
    expect(ownerPermissionsOf(SUPPORT)).toEqual({ add: false, resend: true, mfaReset: true, manage: false });
  });

  it("keeps adding and resending apart: owners.invite alone does not offer a resend", () => {
    expect(ownerPermissionsOf(["owners.invite"])).toMatchObject({ add: true, resend: false });
    expect(ownerPermissionsOf(["owners.resend"])).toMatchObject({ add: false, resend: true });
  });

  it("offers nothing without permissions", () => {
    expect(ownerPermissionsOf([])).toEqual({ add: false, resend: false, mfaReset: false, manage: false });
  });
});

describe("ownerActions", () => {
  const all: OwnerPermissions = { add: true, resend: true, mfaReset: true, manage: true };

  it("offers a resend only to an active owner who has not joined, and only with owners.resend", () => {
    expect(ownerActions(invited, all)).toEqual(["resend", "suspend"]);
    expect(ownerActions(invited, ownerPermissionsOf(SUPPORT))).toEqual(["resend"]);
    expect(ownerActions(invited, ownerPermissionsOf(["owners.invite"]))).toEqual([]);
    expect(ownerActions({ ...invited, status: "disabled" }, ownerPermissionsOf(SUPPORT))).toEqual([]);
    expect(ownerActions(joined, ownerPermissionsOf(SUPPORT))).toEqual(["mfaReset"]);
  });

  it("suspends an active owner and reactivates a suspended one, with owners.manage", () => {
    expect(ownerActions(joined, all)).toEqual(["mfaReset", "suspend"]);
    expect(ownerActions(suspended, all)).toEqual(["reactivate"]);
    expect(ownerActions(suspended, ownerPermissionsOf(SUPPORT))).toEqual([]);
  });
});
