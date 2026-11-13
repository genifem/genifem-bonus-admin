import { createApiClient } from "@crewstars/api-client";
import { cookies, headers } from "next/headers";

import { requestTarget } from "@/lib/host";
import { jarFor } from "@/lib/session";
import { clientIp, upstreamHeaders } from "@/lib/upstream";

/**
 * Server Components and Route Handlers talk to the API directly (API_INTERNAL_URL), never
 * through the browser-facing /api proxy. Each call carries what the proxy would have added:
 * the operator (X-Tenant, on an operator's host), this host's session cookie as a bearer token
 * (the owner's, or the back office's on admin.<base>), and the host and IP the browser came
 * from (lib/upstream.ts). The host is the request's own Host header, the one src/proxy.ts
 * routed on, so the page and the operator it asks about always agree.
 */
async function callContext() {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const jar = jarFor(requestTarget(headerStore));
  const token = jar ? cookieStore.get(jar.access)?.value : undefined;
  const host = headerStore.get("host");
  return { token, forwarded: upstreamHeaders(host, clientIp(headerStore)) };
}

/** The typed client (generated from the API's OpenAPI schema). */
export async function serverApi() {
  const { token, forwarded } = await callContext();
  return createApiClient({
    baseUrl: apiBase(),
    accessToken: () => token,
    fetch: (input, init) => {
      const request = new Request(input, init);
      for (const [name, value] of Object.entries(forwarded)) request.headers.set(name, value);
      return fetch(request, { cache: "no-store" });
    },
  });
}

/**
 * An untyped GET, for an endpoint the committed schema does not describe yet (the schema is
 * regenerated from bonus-backend as each phase lands). Returns the parsed JSON body, or null
 * when the call fails for any reason: callers use it for chrome that must not break the page.
 */
export async function serverGetJson(path: `/api/v1/${string}`): Promise<unknown> {
  const { token, forwarded } = await callContext();
  const requestHeaders = new Headers(forwarded);
  requestHeaders.set("accept", "application/json");
  if (token) requestHeaders.set("authorization", `Bearer ${token}`);
  try {
    const response = await fetch(new URL(path, apiBase()), {
      headers: requestHeaders,
      cache: "no-store",
    });
    if (!response.ok) return null;
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

export function apiBase(): string {
  return process.env.API_INTERNAL_URL ?? "http://127.0.0.1:8000";
}
