import { parseHost } from "@/lib/host";

/**
 * What the web server tells the API on every call it makes: which operator the browser is on,
 * the host the browser asked for, and the browser's IP (rate limits, audit).
 *
 * The operator is the first label of the host (P7: acme.stars.genifem.com is `acme`, see
 * lib/host.ts), sent upstream as X-Tenant. Only for an operator's host: the back office
 * (admin.<base>) and "Find your company" (<base>) name no operator. A browser can never choose
 * it: the BFF forwards only an allowlist of request headers, so a client-sent X-Tenant or
 * Authorization is dropped before this is added, and the host is the one the request came in on.
 *
 * From Vercel the API is reached over the internet through Caddy, which overwrites
 * X-Forwarded-*, so the host and IP also go in X-CS-* headers with a shared secret that proves
 * they came from us (API_PROXY_SECRET here, CS_PROXY_SECRET on the API). The API's back office
 * routes check that host is admin.<base> (403 platform_host_required). Server-only: neither
 * value may be NEXT_PUBLIC_ or read in a client component.
 */

/** A request's headers, or what next/headers' headers() returns. */
export interface HeaderSource {
  get(name: string): string | null;
}

/** The browser's IP. Vercel and Caddy both set X-Forwarded-For themselves, replacing
 *  whatever the browser sent, so its first entry is the client. */
export function clientIp(incoming: HeaderSource): string | null {
  const first = incoming.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || incoming.get("x-real-ip")?.trim() || null;
}

/** The operator a host is for, or null for the back office, the bare domain and strangers. */
export function hostTenant(host: string | null | undefined): string | null {
  const target = parseHost(host);
  return target.kind === "operator" ? target.slug : null;
}

export function upstreamHeaders(
  host: string | null | undefined,
  ip: string | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenant = hostTenant(host);
  if (tenant) headers["x-tenant"] = tenant;
  if (host) headers["x-forwarded-host"] = host;
  if (ip) headers["x-forwarded-for"] = ip;
  const secret = process.env.API_PROXY_SECRET;
  if (secret) {
    headers["x-cs-proxy-secret"] = secret;
    if (host) headers["x-cs-host"] = host;
    if (ip) headers["x-cs-client-ip"] = ip;
  }
  return headers;
}
