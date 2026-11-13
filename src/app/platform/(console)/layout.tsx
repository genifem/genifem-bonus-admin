import { BackOfficeShell } from "@/components/backoffice/BackOfficeShell";
import { requirePlatformAdmin } from "@/lib/platform";

/**
 * Every signed-in back office page. A route group, so /login and /invite sit outside the
 * console's chrome while the URLs stay as the host rewrite makes them (admin.<base>/operators
 * -> /platform/operators). src/proxy.ts has already sent a browser with no session to sign in;
 * this asks the API who is signed in (GET /platform/me), which renews or signs out a session
 * that has lapsed. Each page still checks its own permission.
 */
export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const admin = await requirePlatformAdmin();
  return <BackOfficeShell admin={admin}>{children}</BackOfficeShell>;
}
