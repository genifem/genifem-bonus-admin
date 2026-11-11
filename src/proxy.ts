import { type NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { SIGN_IN } from "@/lib/session-paths";

/**
 * The optimistic session check in front of every portal page (Next.js 16 Proxy, formerly
 * Middleware). One domain, one operator (plan D3), so there is no host routing any more: this
 * only decides whether a page request can go ahead.
 *
 *   access cookie                 -> the page (the API still verifies every call)
 *   refresh cookie only           -> /api/session/refresh, which renews and comes back
 *   neither                       -> /login, remembering where they were going
 *
 * The sign-in page itself, the BFF under /api and static files are never checked.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (pathname === SIGN_IN || request.cookies.has(ACCESS_COOKIE)) return NextResponse.next();

  const here = `${pathname}${search}`;
  const target = request.cookies.has(REFRESH_COOKIE)
    ? `/api/session/refresh?next=${encodeURIComponent(here)}`
    : here === "/"
      ? SIGN_IN
      : `${SIGN_IN}?next=${encodeURIComponent(here)}`;
  return NextResponse.redirect(new URL(target, request.url));
}

export const config = {
  matcher: [
    // Everything except the API proxy, Next internals and public files.
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};
