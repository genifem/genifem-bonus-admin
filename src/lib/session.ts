import type { NextRequest, NextResponse } from "next/server";

import type { HostTarget } from "@/lib/host";
import { clientIp, upstreamHeaders } from "@/lib/upstream";

/**
 * Session cookies, for the owner portal and the back office.
 *
 * Tokens never reach page scripts: the API proxy strips them out of auth responses and stores
 * them here, host-only and httpOnly. The refresh token is injected back into refresh/logout
 * calls by the proxy.
 *
 * Host-only means each operator's portal (acme.<base>) keeps its own owner session and the
 * back office (admin.<base>) its own: a cookie set on one host is never sent to another (P7).
 * The back office's cookies also have names of their own, so code that reads the wrong jar
 * finds nothing rather than another kind of session; the API would refuse one anyway (401
 * token_wrong_kind).
 */

/** The two cookies one session lives in. */
export interface CookieJar {
  access: string;
  refresh: string;
}

/** An owner's session, on their operator's host. */
export const OWNER_JAR: CookieJar = { access: "cs_access", refresh: "cs_refresh" };
/** A Crew Stars admin's session, on the back office's host. */
export const BACK_OFFICE_JAR: CookieJar = { access: "cs_bo_access", refresh: "cs_bo_refresh" };

export const ACCESS_COOKIE = OWNER_JAR.access;
export const REFRESH_COOKIE = OWNER_JAR.refresh;

/** Which session a host keeps: none on the bare domain ("Find your company" signs nobody in)
 *  or on a host that is not ours. */
export function jarFor(target: HostTarget): CookieJar | null {
  if (target.kind === "operator") return OWNER_JAR;
  if (target.kind === "platform") return BACK_OFFICE_JAR;
  return null;
}

/**
 * The session's hard cap (plan NF-04: 12 hours), for owners and the back office alike. The
 * browser drops the refresh cookie at this age whatever the API says, so everyone signs in at
 * least once every 12 hours; the API enforces the same cap on its side.
 */
export const SESSION_MAX_AGE_S = 12 * 60 * 60;

export interface IssuedTokens {
  access_token: string;
  refresh_token?: string | null;
  expires_in: number;
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export function setSessionCookies(
  response: NextResponse,
  tokens: IssuedTokens,
  jar: CookieJar = OWNER_JAR,
): void {
  response.cookies.set(
    jar.access,
    tokens.access_token,
    cookieOptions(Math.min(tokens.expires_in, SESSION_MAX_AGE_S)),
  );
  if (tokens.refresh_token) {
    response.cookies.set(jar.refresh, tokens.refresh_token, cookieOptions(SESSION_MAX_AGE_S));
  }
}

export function clearSessionCookies(response: NextResponse, jar: CookieJar = OWNER_JAR): void {
  for (const name of [jar.access, jar.refresh]) {
    response.cookies.set(name, "", cookieOptions(0));
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Where an auth response keeps its tokens, whatever shape it came in:
 *   TokenOut                   { access_token, refresh_token, user, ... }       (refresh)
 *   OwnerAuthOut               { step, tokens: TokenOut | null, mfa_token }      (owner sign-in,
 *                                                                                 MFA verify)
 *   MfaEnabledOut              { recovery_codes, auth: OwnerAuthOut }            (MFA confirm)
 * and the back office's same three (PlatformTokenOut, PlatformAuthOut, PlatformMfaEnabledOut).
 * Returns the object that holds (or would hold) access_token, so the caller can take them out
 * of the very body that goes on to the browser.
 */
function tokenHolder(body: unknown): Record<string, unknown> | null {
  if (!isRecord(body)) return null;
  const step = isRecord(body.auth) ? body.auth : body;
  return isRecord(step.tokens) ? step.tokens : step;
}

/** Pull tokens out of an auth response body, and strip them from it: the body is what the
 *  browser receives next, and page scripts never see a token. */
export function takeTokens(body: unknown): IssuedTokens | null {
  const holder = tokenHolder(body);
  if (!holder) return null;
  if (typeof holder.access_token !== "string" || typeof holder.expires_in !== "number") return null;
  const tokens: IssuedTokens = {
    access_token: holder.access_token,
    expires_in: holder.expires_in,
    refresh_token: typeof holder.refresh_token === "string" ? holder.refresh_token : null,
  };
  // The browser keeps the user, never the credentials.
  delete holder.access_token;
  delete holder.refresh_token;
  return tokens;
}

/** The language saved on the owner's record wins once they sign in (NF-02). Readable by the
 *  language switcher, which writes the same cookie. A back office admin has none on record,
 *  so their language stays the one they picked. */
export function takeLocale(body: unknown): string | null {
  const user = tokenHolder(body)?.user;
  return isRecord(user) && typeof user.language === "string" ? user.language : null;
}

/** API errors after which the session cannot continue and its cookies go, with no refresh:
 *  the back office signs out after 20 minutes without a request (P7, 401 session_idle). */
export const SESSION_OVER_CODES: ReadonlySet<string> = new Set(["session_idle"]);

export interface RefreshOutcome {
  tokens: IssuedTokens | null;
  /** The API's reason when it refused (session_idle, refresh_expired...); null otherwise. */
  code: string | null;
}

/** Exchange the refresh cookie for a new pair, and say why not when the session is over. An
 *  owner's session renews at /auth/refresh, for the operator on this host (X-Tenant); the back
 *  office's at /auth/platform/refresh. */
export async function refreshSession(
  request: NextRequest,
  apiBase: string,
  jar: CookieJar = OWNER_JAR,
): Promise<RefreshOutcome> {
  const refresh = request.cookies.get(jar.refresh)?.value;
  if (!refresh) return { tokens: null, code: null };
  const endpoint = jar === BACK_OFFICE_JAR ? "/api/v1/auth/platform/refresh" : "/api/v1/auth/refresh";
  const response = await fetch(new URL(endpoint, apiBase), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...upstreamHeaders(request.headers.get("host"), clientIp(request.headers)),
    },
    body: JSON.stringify({ refresh_token: refresh }),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) return { tokens: null, code: errorCode(body) };
  return { tokens: takeTokens(body), code: null };
}

/** The stable `code` of an API error body (app/core/errors.py), if it is one. */
export function errorCode(body: unknown): string | null {
  const error = (body as { error?: { code?: unknown } } | null)?.error;
  return typeof error?.code === "string" ? error.code : null;
}
