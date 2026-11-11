/**
 * What the web server tells the API on every call it makes: which operator this portal serves,
 * the host the browser asked for, and the browser's IP (rate limits, audit).
 *
 * The operator is fixed per deployment (plan D3: one operator, one domain, no tenant
 * subdomains), so it comes from CREWSTARS_TENANT and goes upstream as X-Tenant. A browser can
 * never choose it: the BFF forwards only an allowlist of request headers, so a client-sent
 * X-Tenant or Authorization is dropped before this is added.
 *
 * From Vercel the API is reached over the internet through Caddy, which overwrites
 * X-Forwarded-*, so the host and IP also go in X-CS-* headers with a shared secret that proves
 * they came from us (API_PROXY_SECRET here, CS_PROXY_SECRET on the API). Server-only: neither
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

/** The operator this deployment serves, or null when it is not configured. */
export function portalTenant(): string | null {
  return process.env.CREWSTARS_TENANT?.trim() || null;
}

export function upstreamHeaders(
  host: string | null | undefined,
  ip: string | null | undefined,
): Record<string, string> {
  const headers: Record<string, string> = {};
  const tenant = portalTenant();
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
