import { RESERVED_SLUGS, SLUG_RE } from "./slug";

/**
 * Which surface a request's host is for (P7). One Next.js app serves all three, told apart by
 * the host the browser asked for, under one base domain (CREWSTARS_BASE_DOMAIN):
 *
 *   acme.<base>    the owner portal of the operator `acme`   { kind: "operator", slug }
 *   admin.<base>   the back office                            { kind: "platform" }
 *   <base>         "Find your company"                        { kind: "site" }
 *   anything else  404                                         { kind: "unknown" }
 *
 * Deployed, the base is stars.genifem.com; locally it is `localhost`, so demo.localhost:3003,
 * admin.localhost:3003 and localhost:3003 (browsers send *.localhost to this machine).
 *
 * The same answer decides the page (src/proxy.ts), the cookies (lib/session.ts) and the
 * operator the API is told about (X-Tenant, lib/upstream.ts), always read from the request's
 * own Host header: an operator is never something a browser can name any other way.
 * Mirrors bonus-backend app/core/config.py (platform_host, operator_url).
 *
 * Server-only in practice: the base domain is a server environment variable, read at run time,
 * so one build serves any domain.
 */

/** The back office's label: admin.<base>. Never an operator (it is a reserved slug). */
export const PLATFORM_LABEL = "admin";

/** The path as the browser asked for it (`/operators?q=acme`), which src/proxy.ts passes to
 *  the back office's pages it serves from under /platform: a Server Component cannot see it
 *  any other way, and the console needs it to come back after renewing a session. */
export const PATH_HEADER = "x-cs-path";

export type HostTarget =
  | { kind: "operator"; slug: string }
  | { kind: "platform" }
  | { kind: "site" }
  | { kind: "unknown" };

/** `Stars.Genifem.com.` -> `stars.genifem.com`; anything that is not a bare host name -> "". */
function normalDomain(value: string | undefined): string {
  const domain = (value ?? "").trim().toLowerCase().replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(domain) ? domain : "";
}

/** The base domain this deployment answers under (CREWSTARS_BASE_DOMAIN), `localhost` when
 *  unset - which, deployed, makes every real host a 404 rather than guessing. */
export function baseDomain(): string {
  return normalDomain(process.env.CREWSTARS_BASE_DOMAIN) || "localhost";
}

/** A Host header's name alone: lower case, no port, no trailing dot, the first of a list. */
export function hostName(host: string | null | undefined): string {
  const first = (host ?? "").split(",")[0]!.trim().toLowerCase();
  // An IPv6 literal ([::1]:3003) is never one of ours; it keeps its brackets and fails below.
  return first.replace(/:\d+$/, "").replace(/\.$/, "");
}

export function parseHost(host: string | null | undefined, base: string = baseDomain()): HostTarget {
  const name = hostName(host);
  if (!name || !base) return { kind: "unknown" };
  if (name === base) return { kind: "site" };
  const suffix = `.${base}`;
  if (!name.endsWith(suffix)) return { kind: "unknown" };
  const label = name.slice(0, -suffix.length);
  // One label only: a.b.<base> is nobody.
  if (!label || label.includes(".")) return { kind: "unknown" };
  if (label === PLATFORM_LABEL) return { kind: "platform" };
  if (!SLUG_RE.test(label) || RESERVED_SLUGS.includes(label)) return { kind: "unknown" };
  return { kind: "operator", slug: label };
}

/** A request's headers, or what next/headers' headers() returns. */
export interface HostSource {
  get(name: string): string | null;
}

/** The surface a request is for, from its own Host header. */
export function requestTarget(headers: HostSource): HostTarget {
  return parseHost(headers.get("host"));
}

/**
 * What adding an operator's address takes by hand (there is no wildcard domain): a CNAME at
 * the DNS host and the domain in Vercel. The record's name is relative to the zone, which is
 * taken to be the base domain's last two labels (genifem.com, at Hostinger), so for
 * `acme` under stars.genifem.com it is `acme.stars`. Null for a one-label base (`localhost`),
 * where *.localhost needs no DNS at all.
 */
export interface SubdomainSetup {
  /** acme.stars.genifem.com: the domain to add in Vercel. */
  host: string;
  /** acme.stars: the CNAME record's name at the DNS host. */
  record: string;
  /** genifem.com: the zone that record goes in. */
  zone: string;
}

export function subdomainSetup(slug: string, base: string = baseDomain()): SubdomainSetup | null {
  const labels = base.split(".").filter(Boolean);
  if (labels.length < 2) return null;
  const zone = labels.slice(-2).join(".");
  const within = labels.slice(0, -2);
  return { host: `${slug}.${base}`, record: [slug, ...within].join("."), zone };
}
