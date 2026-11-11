import type { Schemas } from "@crewstars/api-client";
import { cache } from "react";

import { serverApi } from "@/lib/server-api";

/** The signed-in owner, as much as the portal chrome needs of them. */
export interface Owner {
  /** Full name, for "Signed in as". */
  name: string;
  /** What to greet them by ("Hi Grant"). */
  firstName: string;
}

/** The chrome's view of GET /me (MeOut): the full name, and the first name the API works out,
 *  or the name's first word when it sends none. Null when there is no name to show. */
export function ownerFrom(me: Pick<Schemas["MeOut"], "name" | "first_name">): Owner | null {
  const name = me.name.trim().replace(/\s+/g, " ");
  if (!name) return null;
  const first = me.first_name.trim();
  return { name, firstName: first || name.split(" ")[0]! };
}

/**
 * Whoever is signed in (GET /api/v1/me), fetched once per request so the sidebar and the page
 * share one call. The chrome decides nothing with it: when the call fails for any reason this
 * is null and the portal draws without a name. src/proxy.ts and the API are what keep a
 * signed-out browser out.
 */
export const loadOwner = cache(async (): Promise<Owner | null> => {
  try {
    const api = await serverApi();
    const { data } = await api.GET("/api/v1/me");
    return data ? ownerFrom(data) : null;
  } catch {
    return null;
  }
});
