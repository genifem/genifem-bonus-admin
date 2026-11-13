import { ApiError, type Schemas } from "@crewstars/api-client";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { PATH_HEADER } from "@/lib/host";
import { serverApi } from "@/lib/server-api";
import { BACK_OFFICE_JAR } from "@/lib/session";
import { safeNext, SIGN_IN } from "@/lib/session-paths";

/** A back office permission, as the API names it ("operators.write"). */
export type PlatformPermission = Schemas["Perm"];
export type PlatformRole = Schemas["PlatformRole"];

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  /** What this admin may do, from the table the API enforces (permissions.py): super_admin
   *  everything, support reading plus helping owners in. */
  permissions: readonly PlatformPermission[];
  mfaEnabled: boolean;
}

/**
 * The Crew Stars admin signed in to the back office (admin.<base>, P7), from GET /platform/me.
 * It is not inside any operator, so there is no X-Tenant here (lib/upstream.ts sends none on
 * this host).
 *
 * Cached per request: the console layout needs the name for its rail and each page checks the
 * permissions for itself, and that should cost one call to the API rather than two.
 *
 * The permissions decide what a page shows (an action the admin cannot take is not offered).
 * They are a courtesy to the reader only: the API checks every call itself (403
 * platform_permission_missing).
 *
 * When the API refuses the session: an expired access token is renewed once through
 * /api/session/refresh, which comes back here; a session that went idle (401 session_idle)
 * goes the same way, where the API says so again and the sign-in page explains it.
 */
export const requirePlatformAdmin = cache(async (): Promise<PlatformAdmin> => {
  let data: Schemas["PlatformMeOut"] | undefined;
  try {
    data = (await (await serverApi()).GET("/api/v1/platform/me")).data;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) await renewOrSignIn();
    throw err;
  }
  if (!data) redirect(SIGN_IN);
  return {
    id: data.id,
    name: data.name || data.email,
    email: data.email,
    role: data.role,
    permissions: data.permissions,
    mfaEnabled: data.mfa_enabled,
  };
});

/** A 401 from the back office: renew once if there is something to renew with (the refresh
 *  route signs out, with the reason, when it cannot), else sign in. */
async function renewOrSignIn(): Promise<never> {
  const [jar, requestHeaders] = await Promise.all([cookies(), headers()]);
  const here = safeNext(requestHeaders.get(PATH_HEADER));
  if (jar.has(BACK_OFFICE_JAR.refresh)) redirect(`/api/session/refresh?next=${encodeURIComponent(here)}`);
  redirect(here === "/" ? SIGN_IN : `${SIGN_IN}?next=${encodeURIComponent(here)}`);
}

/** Whether the admin holds a permission: `can(admin, "operators.write")`. */
export function can(admin: Pick<PlatformAdmin, "permissions">, permission: PlatformPermission): boolean {
  return admin.permissions.includes(permission);
}
