import { LOCALE_COOKIE } from "@crewstars/i18n";
import { type NextRequest, NextResponse } from "next/server";

import { parseHost, type HostTarget } from "@/lib/host";
import {
  BACK_OFFICE_JAR,
  clearSessionCookies,
  errorCode,
  OWNER_JAR,
  refreshSession,
  SESSION_OVER_CODES,
  setSessionCookies,
  takeLocale,
  takeTokens,
  type CookieJar,
  type IssuedTokens,
} from "@/lib/session";
import { apiBase } from "@/lib/server-api";
import { clientIp, upstreamHeaders } from "@/lib/upstream";

/**
 * Same-origin proxy from the browser to the Crew Stars API (backend-for-frontend).
 *
 * - The host decides who is calling (P7, lib/host.ts): on an operator's host the operator is
 *   sent upstream as X-Tenant (lib/upstream.ts) with the owner's session; on admin.<base> the
 *   back office's session, and only the back office's endpoints (/platform, /auth/platform);
 *   on the bare domain only the public "Find your company" call, with no session at all. Any
 *   other host is a 404. Only the headers in FORWARD_REQUEST_HEADERS pass through, so a
 *   client-sent X-Tenant, X-Forwarded-*, X-CS-* or Authorization header never reaches the API.
 * - Tokens live in httpOnly cookies (lib/session.ts): this route takes them out of the auth
 *   responses in each surface's token calls, puts the refresh token back into refresh/logout
 *   calls, and renews once when the access token has aged out mid-session.
 * - A back office session that went idle (401 session_idle) is over: no renewal, the cookies
 *   go, and the page sends the admin to sign in again.
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

interface Surface {
  /** Where this host keeps its session; null for one that keeps none. */
  jar: CookieJar | null;
  /** The calls whose responses carry tokens to keep in cookies (and strip from the body). Any
   *  new endpoint that issues tokens belongs here, or its tokens would reach page scripts. */
  tokenCalls: ReadonlySet<string>;
  /** The calls that need the refresh cookie as their body. */
  refreshBody: ReadonlySet<string>;
  /** Whether this host may call the endpoint at all. */
  reaches: (endpoint: string) => boolean;
}

const isBackOffice = (endpoint: string) =>
  endpoint === "platform" || endpoint.startsWith("platform/") || endpoint.startsWith("auth/platform/");
const isPublic = (endpoint: string) => endpoint.startsWith("public/");

/** An owner's portal. The second factor (plan D8) finishes a sign-in in mfa/verify, or in
 *  mfa/confirm the first time, where the tokens sit under `auth.tokens` beside the recovery
 *  codes (lib/session.ts takeTokens finds them there); an emailed invite or reset link (P7)
 *  signs in as well. */
const OWNER: Surface = {
  jar: OWNER_JAR,
  tokenCalls: new Set([
    "auth/owner/login",
    "auth/owner/mfa/verify",
    "auth/owner/mfa/confirm",
    "auth/owner/invite/accept",
    "auth/owner/reset",
    "auth/refresh",
    "auth/logout",
  ]),
  refreshBody: new Set(["auth/refresh", "auth/logout"]),
  reaches: (endpoint) => !isBackOffice(endpoint) && !isPublic(endpoint),
};

/** The back office: the same steps, under /auth/platform. */
const BACK_OFFICE: Surface = {
  jar: BACK_OFFICE_JAR,
  tokenCalls: new Set([
    "auth/platform/login",
    "auth/platform/mfa/verify",
    "auth/platform/mfa/confirm",
    "auth/platform/invite/accept",
    "auth/platform/refresh",
    "auth/platform/logout",
  ]),
  refreshBody: new Set(["auth/platform/refresh", "auth/platform/logout"]),
  reaches: isBackOffice,
};

/** "Find your company": nobody signs in on the bare domain. */
const SITE: Surface = { jar: null, tokenCalls: new Set(), refreshBody: new Set(), reaches: isPublic };

function surfaceOf(target: HostTarget): Surface | null {
  if (target.kind === "operator") return OWNER;
  if (target.kind === "platform") return BACK_OFFICE;
  if (target.kind === "site") return SITE;
  return null;
}

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
  const surface = surfaceOf(parseHost(request.headers.get("host")));
  const endpoint = path.slice(1).join("/");
  if (
    !surface ||
    path[0] !== "v1" ||
    path.some((seg) => seg === "." || seg === ".." || seg === "") ||
    !surface.reaches(endpoint)
  ) {
    return jsonError("not_found", "not found", 404);
  }
  if (!SAFE_METHODS.has(request.method) && !sameOrigin(request)) {
    return jsonError("csrf_rejected", "cross-origin request rejected", 403);
  }

  const api = apiBase();
  const { jar } = surface;
  const tokenCall = surface.tokenCalls.has(endpoint);
  const isLogout = endpoint === "auth/logout" || endpoint === "auth/platform/logout";
  const isRefresh = endpoint === "auth/refresh" || endpoint === "auth/platform/refresh";
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
    if (surface.refreshBody.has(endpoint)) {
      // The browser cannot read the refresh cookie, so it goes in on the way through.
      const refresh = jar ? request.cookies.get(jar.refresh)?.value : undefined;
      if (!refresh) {
        const refused = jsonError("unauthorized", "no session", 401);
        // Nothing to revoke, but a sign-out still leaves nothing behind.
        if (isLogout && jar) clearSessionCookies(refused, jar);
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
  let upstream = await send(jar ? request.cookies.get(jar.access)?.value : undefined);
  // Renew once when the access token aged out - never when the API has said the session
  // itself is over.
  if (upstream.status === 401 && !authCall && jar) {
    const first = errorCode(await upstream.clone().json().catch(() => null));
    if (!first || !SESSION_OVER_CODES.has(first)) {
      renewed = (await refreshSession(request, api, jar)).tokens;
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

  if (issued && jar) setSessionCookies(response, issued, jar);
  if (locale) {
    response.cookies.set(LOCALE_COOKIE, locale, {
      sameSite: "lax",
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  if (
    jar &&
    (isLogout ||
      (isRefresh && !upstream.ok) ||
      // The session could not be renewed: nothing left worth keeping.
      (upstream.status === 401 && !authCall && !renewed) ||
      (failure !== null && SESSION_OVER_CODES.has(failure)))
  ) {
    clearSessionCookies(response, jar);
  }
  return response;
}

export { forward as DELETE, forward as GET, forward as PATCH, forward as POST, forward as PUT };
