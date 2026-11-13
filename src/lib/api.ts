"use client";

import { IDLE_SIGN_IN, SIGNED_OUT } from "@/lib/session-paths";

/**
 * Browser-side API calls. Everything goes to this app's own /api/* path, which proxies to the
 * Crew Stars API, names the operator from the host, and keeps the tokens in httpOnly cookies
 * (see app/api/[...path]/route.ts). The owner portal and the back office both use it: the host
 * they are on decides which session and which endpoints the proxy allows.
 *
 * Errors carry the API's stable `code`, which the UI translates (`errors.<code>`); the
 * server's English message is a developer fallback only. `details` is the API's structured
 * context, for the screens that show it: `{field}` on a 422, `{fields: {path: message}}` when
 * the schema refused the request (`validation_failed`), `{name}` on a 409, `{until,
 * retry_after_s}` on a lockout. lib/api-errors.ts turns it into messages beside the fields.
 *
 * A 401 on anything but an /auth/ call means the session is over - the proxy has already
 * tried a refresh and dropped the cookies - so the owner is sent to sign in again, whatever
 * screen made the call; a back office session that went idle (401 session_idle) is told so on
 * the sign-in page. An /auth/ 401 (a wrong password) is the caller's to show.
 */

export class ApiCallError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiCallError";
  }
}

export interface CallOptions {
  /** Sent as Idempotency-Key, for coin actions (plan D13): one key per tap. */
  idempotencyKey?: string;
}

export async function apiPost<T>(path: string, body?: unknown, options?: CallOptions): Promise<T> {
  return call<T>("POST", path, body, options);
}

export async function apiGet<T>(path: string): Promise<T> {
  return call<T>("GET", path);
}

export async function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return call<T>("PATCH", path, body);
}

export async function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return call<T>("PUT", path, body);
}

export async function apiDelete<T>(path: string): Promise<T> {
  return call<T>("DELETE", path);
}

async function call<T>(method: string, path: string, body?: unknown, options?: CallOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (options?.idempotencyKey) headers["idempotency-key"] = options.idempotencyKey;
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiCallError(0, "network", "network request failed");
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) throw await refusal(response, path);
  return (await response.json().catch(() => null)) as T;
}

/**
 * A file from the API (the payroll CSV, NF-12): its bytes and the API's Content-Disposition,
 * which names it. Fetched rather than followed as a link, so a refusal is said in words on
 * the page instead of replacing it with the API's JSON. The BFF passes the file through as
 * the API sent it.
 */
export async function apiDownload(path: string): Promise<{ blob: Blob; disposition: string | null }> {
  let response: Response;
  try {
    response = await fetch(`/api/v1${path}`);
  } catch {
    throw new ApiCallError(0, "network", "network request failed");
  }
  if (!response.ok) throw await refusal(response, path);
  return { blob: await response.blob(), disposition: response.headers.get("content-disposition") };
}

/** A failed response as an ApiCallError, sending the owner to sign in when the session is over. */
async function refusal(response: Response, path: string): Promise<ApiCallError> {
  const payload: unknown = await response.json().catch(() => null);
  const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
  const code = error?.code ?? `http_${response.status}`;
  if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
    window.location.assign(code === "session_idle" ? IDLE_SIGN_IN : SIGNED_OUT);
  }
  return new ApiCallError(response.status, code, error?.message ?? response.statusText, error?.details);
}
