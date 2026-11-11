/** Query-string helpers for lists that keep their state in the URL.
 *
 *  Sorting, filtering and paging are links and GET forms, not React state, which is what lets
 *  a list page stay a Server Component: no fetch on the client, no spinner, and the back
 *  button and a shared URL both do what you would expect. */

export type Query = Record<string, string | string[] | undefined>;

/** The current query with `changes` applied. A null value drops the key. */
export function withQuery(current: Query, changes: Record<string, string | number | null>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(current)) {
    if (typeof value === "string" && value !== "") params.set(key, value);
  }
  for (const [key, value] of Object.entries(changes)) {
    if (value === null || value === "") params.delete(key);
    else params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}

export function readNumber(query: Query, key: string, fallback: number): number {
  const raw = query[key];
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readString(query: Query, key: string): string | undefined {
  const raw = query[key];
  return typeof raw === "string" && raw !== "" ? raw : undefined;
}
