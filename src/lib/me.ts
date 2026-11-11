import { cache } from "react";

import { serverGetJson } from "@/lib/server-api";

/** The signed-in owner, as much as the portal chrome needs of them. */
export interface Owner {
  /** Full name, for "Signed in as". */
  name: string;
  /** What to greet them by ("Hi Grant"). */
  firstName: string;
}

const text = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/**
 * Whoever is signed in (GET /api/v1/me), fetched once per request so the sidebar and the page
 * share one call. The chrome decides nothing with it: when the endpoint is not there yet (it
 * arrives in P1) or the call fails, this is null and the portal draws without a name.
 *
 * Read tolerantly, because the response is not in the committed schema yet: `first_name` /
 * `last_name` as the API's other people records use, or a single `name`.
 */
export const loadOwner = cache(async (): Promise<Owner | null> => {
  const body = await serverGetJson("/api/v1/me");
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const holder = (
    typeof record.user === "object" && record.user !== null ? record.user : record
  ) as Record<string, unknown>;
  const first = text(holder.first_name);
  const full = [first, text(holder.last_name)].filter(Boolean).join(" ") || text(holder.name);
  if (!full) return null;
  return { name: full, firstName: first || full.split(/\s+/)[0]! };
});
