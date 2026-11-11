import { redirect } from "next/navigation";

/** What a page's reads came to: the data, or the code of the error that stopped them. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; code: string };

function failureOf(err: unknown): { status: number; code: string } | null {
  if (typeof err !== "object" || err === null) return null;
  const { status, code } = err as { status?: unknown; code?: unknown };
  return typeof status === "number" && typeof code === "string" ? { status, code } : null;
}

/**
 * A Server Component's API reads (lib/server-api.ts), settled for the page to draw.
 *
 * A 401 means the session ended under the page (revoked, or past its 12 hours) while the
 * access cookie was still there: the browser goes through /api/session/refresh, which renews
 * and comes straight back to `here`, or signs out. Any other failure is the page's to show,
 * in words (ErrorState), with the API's code.
 */
export async function settle<T>(here: string, work: () => Promise<T>): Promise<Loaded<T>> {
  let failure: { status: number; code: string } | null = null;
  try {
    return { ok: true, data: await work() };
  } catch (err) {
    failure = failureOf(err) ?? { status: 0, code: "network" };
  }
  if (failure.status === 401) redirect(`/api/session/refresh?next=${encodeURIComponent(here)}`);
  return { ok: false, code: failure.code };
}

/** The body of a typed-client call that succeeded. The client throws on any error status
 *  (packages/api-client), so a missing body is the API breaking its own contract. */
export function body<T>(result: { data?: T }): T {
  if (result.data === undefined) throw Object.assign(new Error("empty response"), { status: 0, code: "generic" });
  return result.data;
}
