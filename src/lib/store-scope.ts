// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that server pages, the rail and the unit tests all use as plain logic.
import { readString, withQuery, type Query } from "@/components/ui/query";

/**
 * The store filter (OP-01): "All stores" or one store, on Overview, Stores & people,
 * Redemptions and Monthly awards.
 *
 * It lives in the URL as the store's number (`?store=2741`, plan §9), the way the Roster page
 * already keeps it, so a filtered view can be shared, reloaded and undone with the back button.
 * The rail carries it from one of these pages to the next (console/ScopedNavLink.tsx). The API
 * wants the store's id, which `findStore` looks up among the operator's stores; an id in the
 * URL is accepted too.
 *
 * Pure, so it can be tested on its own.
 */

export const STORE_PARAM = "store";

/** The pages the shared filter belongs to. Monthly awards (P4) reads it once it is built;
 *  the rail already carries it there. */
export const SCOPED_PATHS: readonly string[] = ["/", "/people", "/redemptions", "/awards"];

/** A store number is short; anything longer is not one. */
const MAX_STORE = 40;

export function isScopedPath(path: string): boolean {
  const bare = path.length > 1 ? path.replace(/\/+$/, "") : path;
  return SCOPED_PATHS.includes(bare || "/");
}

/** The store the URL names, as written; undefined for all stores. */
export function storeParam(query: Query): string | undefined {
  const raw = readString(query, STORE_PARAM)?.trim();
  return raw ? raw.slice(0, MAX_STORE) : undefined;
}

/** The store `param` names among the operator's: by number whatever its case, or by id. An
 *  unknown store is undefined, which the pages show as all stores rather than as nothing. */
export function findStore<S extends { id: string; number: string }>(
  param: string | undefined,
  stores: readonly S[],
): S | undefined {
  if (!param) return undefined;
  const wanted = param.toLowerCase();
  return stores.find((store) => store.number.toLowerCase() === wanted) ?? stores.find((store) => store.id === param);
}

/** `href` with the store filter set, or dropped for all stores. The rest of its query and its
 *  hash are kept. */
export function hrefWithStore(href: string, store: string | null | undefined): string {
  // Parsed against a throwaway origin: only the path, query and hash of the short href matter.
  const url = new URL(href, "http://link.invalid");
  if (store) url.searchParams.set(STORE_PARAM, store);
  else url.searchParams.delete(STORE_PARAM);
  const search = url.searchParams.toString();
  return `${url.pathname}${search ? `?${search}` : ""}${url.hash}`;
}

/** The page at `path` filtered to `store` (null: all stores), keeping the rest of `query` but
 *  starting again from the first page of any list. */
export function storeHref(path: string, query: Query, store: string | null): string {
  return `${path}${withQuery(query, { [STORE_PARAM]: store, offset: null })}`;
}
