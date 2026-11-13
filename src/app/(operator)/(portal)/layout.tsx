import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ConsoleShell } from "@/components/console/ConsoleShell";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/session";
import { SIGN_IN } from "@/lib/session-paths";

/**
 * Every owner-portal page sits in this layout: the rail and the page column. src/proxy.ts has
 * already sent a browser with no session to /login; this is the same check again, so a page
 * can never render without one even if the proxy's matcher misses a path.
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies();
  if (!jar.has(ACCESS_COOKIE) && !jar.has(REFRESH_COOKIE)) redirect(SIGN_IN);
  return <ConsoleShell>{children}</ConsoleShell>;
}
