import { type NextRequest, NextResponse } from "next/server";

import { parseHost } from "@/lib/host";
import { clearSessionCookies, jarFor, refreshSession, setSessionCookies } from "@/lib/session";
import { IDLE_SIGN_IN, safeNext, SIGN_IN, SIGNED_OUT } from "@/lib/session-paths";
import { apiBase } from "@/lib/server-api";

/**
 * Server Components cannot set cookies, so when a page is asked for with an expired access
 * token (src/proxy.ts sends it here), the browser comes here first: renew, then carry on to
 * where they were going. Without this an owner would be bounced to sign-in every time the
 * short-lived access token lapsed, rather than once their 12-hour session is over.
 *
 * The host says whose session it is (lib/host.ts): an owner's on an operator's host, an
 * admin's on admin.<base>. A back office session the API signed out for inactivity (401
 * session_idle) is not renewed; the sign-in page says why.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const destination = safeNext(request.nextUrl.searchParams.get("next"));
  // Redirect against the host the browser used, not the address the server was reached on.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.url;

  const jar = jarFor(parseHost(request.headers.get("host")));
  if (!jar) return NextResponse.redirect(new URL("/", base));

  const hadSession = request.cookies.has(jar.refresh);
  const { tokens, code } = await refreshSession(request, apiBase(), jar);
  if (!tokens) {
    const where = code === "session_idle" ? IDLE_SIGN_IN : hadSession ? SIGNED_OUT : SIGN_IN;
    const out = NextResponse.redirect(new URL(where, base));
    clearSessionCookies(out, jar);
    return out;
  }
  const response = NextResponse.redirect(new URL(destination, base));
  setSessionCookies(response, tokens, jar);
  return response;
}
