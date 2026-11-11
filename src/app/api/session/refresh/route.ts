import { type NextRequest, NextResponse } from "next/server";

import { clearSessionCookies, REFRESH_COOKIE, refreshSession, setSessionCookies } from "@/lib/session";
import { safeNext, SIGN_IN, SIGNED_OUT } from "@/lib/session-paths";
import { apiBase } from "@/lib/server-api";

/**
 * Server Components cannot set cookies, so when a page is asked for with an expired access
 * token (src/proxy.ts sends it here), the browser comes here first: renew, then carry on to
 * where they were going. Without this an owner would be bounced to sign-in every time the
 * short-lived access token lapsed, rather than once their 12-hour session is over.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const destination = safeNext(request.nextUrl.searchParams.get("next"));
  // Redirect against the host the browser used, not the address the server was reached on.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  const base = host ? `${proto}://${host}` : request.url;

  const hadSession = request.cookies.has(REFRESH_COOKIE);
  const { tokens } = await refreshSession(request, apiBase());
  if (!tokens) {
    const out = NextResponse.redirect(new URL(hadSession ? SIGNED_OUT : SIGN_IN, base));
    clearSessionCookies(out);
    return out;
  }
  const response = NextResponse.redirect(new URL(destination, base));
  setSessionCookies(response, tokens);
  return response;
}
