import type { NextRequest, NextResponse } from "next/server";

import { clientIp, upstreamHeaders } from "@/lib/upstream";

/**
 * Session cookies for the owner portal.
 *
 * Tokens never reach page scripts: the API proxy strips them out of auth responses and stores
 * them here, host-only and httpOnly. The refresh token is injected back into refresh/logout
 * calls by the proxy.
 */
export const ACCESS_COOKIE = "cs_access";
export const REFRESH_COOKIE = "cs_refresh";

/**
 * The portal session's hard cap (plan NF-04: 12 hours). The browser drops the refresh cookie
 * at this age whatever the API says, so an owner signs in at least once every 12 hours; the
 * API enforces the same cap on its side.
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

export function setSessionCookies(response: NextResponse, tokens: IssuedTokens): void {
  response.cookies.set(
    ACCESS_COOKIE,
    tokens.access_token,
    cookieOptions(Math.min(tokens.expires_in, SESSION_MAX_AGE_S)),
  );
  if (tokens.refresh_token) {
    response.cookies.set(REFRESH_COOKIE, tokens.refresh_token, cookieOptions(SESSION_MAX_AGE_S));
  }
}

export function clearSessionCookies(response: NextResponse): void {
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE]) {
    response.cookies.set(name, "", cookieOptions(0));
  }
}

/** Pull tokens out of an auth response body, whatever shape it came in. */
export function takeTokens(body: unknown): IssuedTokens | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const holder = (
    typeof record.tokens === "object" && record.tokens !== null ? record.tokens : record
  ) as Record<string, unknown>;
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
 *  language switcher, which writes the same cookie. */
export function takeLocale(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const record = body as Record<string, unknown>;
  const holder = (
    typeof record.tokens === "object" && record.tokens !== null ? record.tokens : record
  ) as Record<string, unknown>;
  const user = holder.user as { language?: unknown } | undefined;
  return typeof user?.language === "string" ? user.language : null;
}

/** API errors after which the session cannot continue and its cookies go, with no refresh. */
export const SESSION_OVER_CODES: ReadonlySet<string> = new Set(["session_idle"]);

export interface RefreshOutcome {
  tokens: IssuedTokens | null;
  /** The API's reason when it refused (refresh_expired...); null otherwise. */
  code: string | null;
}

/** Exchange the refresh cookie for a new pair, and say why not when the session is over. */
export async function refreshSession(request: NextRequest, apiBase: string): Promise<RefreshOutcome> {
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refresh) return { tokens: null, code: null };
  const response = await fetch(new URL("/api/v1/auth/refresh", apiBase), {
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
