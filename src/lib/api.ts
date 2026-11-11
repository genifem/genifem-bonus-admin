"use client";

import { SIGNED_OUT } from "@/lib/session-paths";

/**
 * Browser-side API calls. Everything goes to this app's own /api/* path, which proxies to the
 * Crew Stars API, names the operator, and keeps the tokens in httpOnly cookies (see
 * app/api/[...path]/route.ts).
 *
 * Errors carry the API's stable `code`, which the UI translates (`errors.<code>`); the
 * server's English message is a developer fallback only. `details` is the API's structured
 * context (field errors on a 422), for the screens that show it.
 *
 * A 401 on anything but an /auth/ call means the session is over - the proxy has already
 * tried a refresh and dropped the cookies - so the owner is sent to sign in again, whatever
 * screen made the call. An /auth/ 401 (a wrong password) is the caller's to show.
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
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string; details?: unknown } } | null)
      ?.error;
    const code = error?.code ?? `http_${response.status}`;
    if (response.status === 401 && !path.startsWith("/auth/") && typeof window !== "undefined") {
      window.location.assign(SIGNED_OUT);
    }
    throw new ApiCallError(response.status, code, error?.message ?? response.statusText, error?.details);
  }
  return payload as T;
}
