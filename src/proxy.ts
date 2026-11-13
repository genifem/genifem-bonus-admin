import { type NextRequest, NextResponse } from "next/server";

import { parseHost, PATH_HEADER } from "@/lib/host";
import { BACK_OFFICE_JAR, OWNER_JAR, type CookieJar } from "@/lib/session";
import { BACK_OFFICE_PUBLIC_PATHS, OWNER_PUBLIC_PATHS, SIGN_IN } from "@/lib/session-paths";

/**
 * Host routing and the optimistic session check, in front of every page (Next.js 16 Proxy,
 * formerly Middleware). One app serves three surfaces under the base domain (P7, lib/host.ts):
 *
 *   {slug}.<base>/roster  ->  /roster              the owner portal of that operator
 *   admin.<base>/staff    ->  /platform/staff      the back office
 *   <base>/               ->  /site                "Find your company"
 *   any other host        ->  404
 *
 * The owner portal's pages sit at the root of the app, as they did before there were
 * subdomains, so on an operator's host nothing is rewritten; the back office's and the bare
 * domain's are served from under their own folder. Their folders are a 404 on an operator's
 * host, and on those two hosts every path is pushed under the folder, so /platform/... on
 * admin.<base> becomes /platform/platform/... and 404s: no host can reach another's pages.
 * Links inside the app are always the short paths.
 *
 * Then, for the owner portal and the back office, each with its own cookies (lib/session.ts):
 *
 *   access cookie                 -> the page (the API still verifies every call)
 *   refresh cookie only           -> /api/session/refresh, which renews and comes back
 *   neither                       -> /login, remembering where they were going
 *
 * The pages that open without a session (sign-in, invite and reset links), the BFF under /api
 * and static files are never checked. Which operator a host names is not checked here, which
 * would cost a call to the API on every navigation: the operator portal's layout asks the API
 * once per page and shows a page of its own for an unknown or suspended one.
 */

/** The folders that hold one surface's pages. */
const SURFACE_FOLDERS = ["/platform", "/site"];

export function proxy(request: NextRequest) {
  const target = parseHost(request.headers.get("host"));
  const { pathname } = request.nextUrl;

  switch (target.kind) {
    case "operator":
      if (SURFACE_FOLDERS.some((folder) => pathname === folder || pathname.startsWith(`${folder}/`))) {
        // A private folder (`_`) is never a route: the app's own 404 page, with a 404.
        return NextResponse.rewrite(new URL("/_none", request.url));
      }
      return sessionGate(request, OWNER_JAR, OWNER_PUBLIC_PATHS) ?? NextResponse.next();
    case "platform":
      return sessionGate(request, BACK_OFFICE_JAR, BACK_OFFICE_PUBLIC_PATHS) ?? serveFrom(request, "/platform");
    case "site":
      return serveFrom(request, "/site");
    default:
      return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain" } });
  }
}

/** Off to sign in (or to renew first) when a page needs a session and there is none. */
function sessionGate(
  request: NextRequest,
  jar: CookieJar,
  open: ReadonlySet<string>,
): NextResponse | null {
  const { pathname, search } = request.nextUrl;
  if (open.has(pathname) || request.cookies.has(jar.access)) return null;
  const here = `${pathname}${search}`;
  const target = request.cookies.has(jar.refresh)
    ? `/api/session/refresh?next=${encodeURIComponent(here)}`
    : here === "/"
      ? SIGN_IN
      : `${SIGN_IN}?next=${encodeURIComponent(here)}`;
  return NextResponse.redirect(new URL(target, request.url));
}

/** The page under `folder`, with the short path passed along for the page to read. */
function serveFrom(request: NextRequest, folder: string): NextResponse {
  const url = request.nextUrl.clone();
  const path = url.pathname === "/" ? "" : url.pathname;
  url.pathname = `${folder}${path}`;
  const headers = new Headers(request.headers);
  headers.set(PATH_HEADER, `${path || "/"}${request.nextUrl.search}`);
  return NextResponse.rewrite(url, { request: { headers } });
}

export const config = {
  matcher: [
    // Everything except the API proxy, Next internals and public files.
    "/((?!api/|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|.*\\.(?:png|svg|jpg|jpeg|webp|ico|txt)$).*)",
  ],
};
