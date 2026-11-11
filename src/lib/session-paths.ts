/**
 * Where a session that cannot go on sends the browser. Plain constants, so the browser-side
 * API helper (lib/api.ts), the proxy and the /api routes agree without the client importing
 * anything server-only.
 */

/** The sign-in page. */
export const SIGN_IN = "/login";

/** The sign-in page, saying the session ended (expired, revoked or over its 12 hours). */
export const SIGNED_OUT = "/login?signedOut=1";

/** A same-site path to carry on to after signing in, or the overview. Never an absolute URL
 *  someone else supplied (`//evil.example` included). */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}
