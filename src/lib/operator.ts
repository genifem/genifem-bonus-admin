import { ApiError } from "@crewstars/api-client";
import { cache } from "react";

import { serverApi } from "@/lib/server-api";

/**
 * The operator this host names (P7: acme.<base> is `acme`), as GET /meta sees it: open, not
 * there at all (404 tenant_not_found), or suspended from the back office (403
 * tenant_suspended). `unreachable` when the API could not say, which is not the operator's
 * fault: the pages then carry on and say so themselves where a call fails.
 *
 * Asked once per request (the layout and a page share it), and never by src/proxy.ts, which
 * would make every navigation wait on the API.
 */
export type OperatorState =
  | { state: "open"; slug: string; name: string }
  | { state: "missing" }
  | { state: "suspended" }
  | { state: "unreachable" };

export const loadOperator = cache(async (): Promise<OperatorState> => {
  try {
    const api = await serverApi();
    const { data } = await api.GET("/api/v1/meta");
    return data ? { state: "open", slug: data.tenant, name: data.name } : { state: "unreachable" };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.code === "tenant_not_found") return { state: "missing" };
      if (err.code === "tenant_suspended") return { state: "suspended" };
    }
    return { state: "unreachable" };
  }
});

/** The company's name, for the sign-in pages' eyebrow; nothing when it is not known. */
export async function operatorName(): Promise<string | undefined> {
  const operator = await loadOperator();
  return operator.state === "open" ? operator.name : undefined;
}
