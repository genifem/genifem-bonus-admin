/**
 * Where a session that cannot go on sends the browser. Plain constants, so the browser-side
 * API helper (lib/api.ts), the proxy and the /api routes agree without the client importing
 * anything server-only.
 *
 * The owner portal and the back office both sign in at /login on their own host (the back
 * office's is admin.<base>/login, src/proxy.ts), so the same paths serve both.
 */

/** The sign-in page. */
export const SIGN_IN = "/login";

/** The sign-in page, saying the session ended (expired, revoked or over its 12 hours). */
export const SIGNED_OUT = "/login?signedOut=1";

/** The sign-in page, saying the back office signed them out after a while without use (401
 *  session_idle), so it does not look like a fault. */
export const IDLE_SIGN_IN = "/login?signedOut=idle";

/** The pages of an operator's host that open without a session: signing in, an emailed
 *  invite or reset link, and asking for one. */
export const OWNER_PUBLIC_PATHS: ReadonlySet<string> = new Set([SIGN_IN, "/invite", "/reset", "/forgot"]);

/** The back office's pages that open without a session: signing in and a colleague's invite. */
export const BACK_OFFICE_PUBLIC_PATHS: ReadonlySet<string> = new Set([SIGN_IN, "/invite"]);

/** A same-site path to carry on to after signing in, or the overview. Never an absolute URL
 *  someone else supplied: not `//evil.example`, not `/\evil.example`, and not `/<tab>/evil.example`
 *  (browsers drop tabs and line breaks inside a URL, which turns it into `//evil.example`).
 *  The path is resolved the way a browser will and kept only if it stays on this site. */
export function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  const cleaned = next.replace(/[\t\r\n]/g, "");
  if (!cleaned.startsWith("/") || cleaned.startsWith("//") || cleaned.startsWith("/\\")) return "/";
  const base = "http://same-site.invalid";
  try {
    const url = new URL(cleaned, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : "/";
  } catch {
    return "/";
  }
}
