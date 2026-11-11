import { LOCALE_COOKIE } from "@crewstars/i18n";
import { type NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  clearSessionCookies,
  errorCode,
  REFRESH_COOKIE,
  refreshSession,
  SESSION_OVER_CODES,
  setSessionCookies,
  takeLocale,
  takeTokens,
  type IssuedTokens,
} from "@/lib/session";
import { apiBase } from "@/lib/server-api";
import { clientIp, upstreamHeaders } from "@/lib/upstream";

/**
 * Same-origin proxy from the browser to the Crew Stars API (backend-for-frontend).
 *
 * - The operator is fixed for this deployment and sent upstream as X-Tenant from
 *   CREWSTARS_TENANT (plan D3), with the browser's host and IP (lib/upstream.ts). Only the
 *   headers in FORWARD_REQUEST_HEADERS pass through, so a client-sent X-Tenant, X-Forwarded-*,
 *   X-CS-* or Authorization header never reaches the API.
 * - Tokens live in httpOnly cookies: this route takes them out of the auth responses in
 *   TOKEN_CALLS, puts the refresh token back into refresh/logout calls, and renews once when
 *   the access token has aged out mid-session.
 * - State-changing requests must come from this same origin (CSRF guard).
 */

const FORWARD_REQUEST_HEADERS = [
  "accept",
  "accept-language",
  "content-type",
  "x-request-id",
  // Coin actions carry one per tap, so a double tap is answered once (plan D13).
  "idempotency-key",
];
const DROP_RESPONSE_HEADERS = new Set([
  "connection",
  "keep-alive",
  "transfer-encoding",
  "content-encoding",
  "content-length",
  "set-cookie",
]);
const SAFE_METHODS = new Set(["GET", "HEAD"]);

/** The calls whose responses carry tokens to keep in cookies (and strip from the body). Any
 *  new endpoint that issues tokens - the owner MFA step, if D8 is switched on - belongs here,
 *  or its tokens would reach page scripts. */
const TOKEN_CALLS = new Set(["auth/owner/login", "auth/refresh", "auth/logout"]);
/** The calls that need the refresh cookie as their body. */
const REFRESH_BODY_PATHS = new Set(["auth/refresh", "auth/logout"]);

function sameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}

function jsonError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

async function forward(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const { path } = await params;
  if (path[0] !== "v1" || path.some((seg) => seg === "." || seg === ".." || seg === "")) {
    return jsonError("not_found", "not found", 404);
  }
  if (!SAFE_METHODS.has(request.method) && !sameOrigin(request)) {
    return jsonError("csrf_rejected", "cross-origin request rejected", 403);
  }

  const api = apiBase();
  const endpoint = path.slice(1).join("/");
  const tokenCall = TOKEN_CALLS.has(endpoint);
  // No auth call is retried after a refresh: a wrong password is a 401 too.
  const authCall = endpoint.startsWith("auth/");

  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, api);
  target.search = request.nextUrl.search;

  const headers = new Headers();
  for (const name of FORWARD_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  const forwarded = upstreamHeaders(request.headers.get("host"), clientIp(request.headers));
  for (const [name, value] of Object.entries(forwarded)) headers.set(name, value);

  let body: string | ArrayBuffer | undefined;
  if (!SAFE_METHODS.has(request.method)) {
    if (REFRESH_BODY_PATHS.has(endpoint)) {
      // The browser cannot read the refresh cookie, so it goes in on the way through.
      const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
      if (!refresh) {
        const refused = jsonError("unauthorized", "no session", 401);
        // Nothing to revoke, but a sign-out still leaves nothing behind.
        if (endpoint === "auth/logout") clearSessionCookies(refused);
        return refused;
      }
      headers.set("content-type", "application/json");
      body = JSON.stringify({ refresh_token: refresh });
    } else {
      body = await request.arrayBuffer();
    }
  }

  const send = async (token: string | undefined): Promise<Response> => {
    const attempt = new Headers(headers);
    if (token) attempt.set("authorization", `Bearer ${token}`);
    return fetch(target, {
      method: request.method,
      headers: attempt,
      body,
      redirect: "manual",
      cache: "no-store",
    });
  };

  let renewed: IssuedTokens | null = null;
  let upstream = await send(request.cookies.get(ACCESS_COOKIE)?.value);
  // Renew once when the access token aged out - never when the API has said the session
  // itself is over.
  if (upstream.status === 401 && !authCall) {
    const first = errorCode(await upstream.clone().json().catch(() => null));
    if (!first || !SESSION_OVER_CODES.has(first)) {
      renewed = (await refreshSession(request, api)).tokens;
      if (renewed) upstream = await send(renewed.access_token);
    }
  }

  const responseHeaders = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!DROP_RESPONSE_HEADERS.has(key.toLowerCase())) responseHeaders.set(key, value);
  });

  let issued = renewed;
  let locale: string | null = null;
  let failure: string | null = null;
  let response: NextResponse;
  if (upstream.headers.get("content-type")?.includes("application/json")) {
    const payload: unknown = await upstream.json();
    if (upstream.ok && tokenCall) {
      issued = takeTokens(payload) ?? issued;
      locale = takeLocale(payload);
    } else if (!upstream.ok) {
      failure = errorCode(payload);
    }
    response = NextResponse.json(payload, { status: upstream.status, headers: responseHeaders });
  } else {
    response = new NextResponse(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  }

  if (issued) setSessionCookies(response, issued);
  if (locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  if (
    endpoint === "auth/logout" ||
    (endpoint === "auth/refresh" && !upstream.ok) ||
    // The session could not be renewed: nothing left worth keeping.
    (upstream.status === 401 && !authCall && !renewed) ||
    (failure !== null && SESSION_OVER_CODES.has(failure))
  ) {
    clearSessionCookies(response);
  }
  return response;
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };
