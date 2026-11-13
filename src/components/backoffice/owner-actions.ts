import type { Schemas } from "@crewstars/api-client";

import type { PlatformPermission } from "@/lib/platform";

/**
 * Which owner actions the operator page offers, as pure functions so they can be tested on
 * their own (P7). The permissions only decide what is shown: the API checks every call (403
 * platform_permission_missing).
 *
 * Adding an owner and sending an invite again are separate permissions (P6 security review):
 * a new owner can sign in to that operator's portal and see its whole roster, so only super
 * admins add one (`owners.invite`), while support can still resend an existing owner's invite
 * (`owners.resend`) and turn off a lost authenticator (`owners.mfa_reset`).
 */
export interface OwnerPermissions {
  /** "Add owner": POST /platform/operators/{id}/owners. */
  add: boolean;
  /** "Resend invite": POST /platform/operators/{id}/owners/{owner_id}/resend-invite. */
  resend: boolean;
  /** "Reset authenticator": POST .../reset-mfa. */
  mfaReset: boolean;
  /** "Suspend" and "Reactivate". */
  manage: boolean;
}

export function ownerPermissionsOf(permissions: readonly PlatformPermission[]): OwnerPermissions {
  return {
    add: permissions.includes("owners.invite"),
    resend: permissions.includes("owners.resend"),
    mfaReset: permissions.includes("owners.mfa_reset"),
    manage: permissions.includes("owners.manage"),
  };
}

export type OwnerAction = "resend" | "mfaReset" | "suspend" | "reactivate";

type OwnerState = Pick<Schemas["PlatformOwnerOut"], "invited" | "status" | "mfa_enabled">;

/** One owner's actions, in the order the row shows them: each only when it applies to this
 *  owner and the role may take it. */
export function ownerActions(owner: OwnerState, permissions: OwnerPermissions): OwnerAction[] {
  const actions: OwnerAction[] = [];
  // Only an active owner who has not joined yet has an invite to send again.
  if (permissions.resend && owner.invited && owner.status === "active") actions.push("resend");
  if (permissions.mfaReset && owner.mfa_enabled) actions.push("mfaReset");
  if (permissions.manage) actions.push(owner.status === "active" ? "suspend" : "reactivate");
  return actions;
}
