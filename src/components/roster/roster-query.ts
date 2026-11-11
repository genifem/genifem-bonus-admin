import type { Schemas } from "@crewstars/api-client";

// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that the server page and the unit tests both use as plain logic.
import { readNumber, readString, type Query } from "@/components/ui/query";

/**
 * The Roster page's state lives in its URL, like every list in the portal: which tab, and on
 * People the filters and the page. Pure, so it can be tested on its own.
 */

export type Role = Schemas["PersonOut"]["role"];
export type PeopleStatus = "active" | "terminated" | "all";
export type RosterTab = "people" | "stores" | "areas" | "import";

export const ROLES: readonly Role[] = ["crew", "shift", "gm", "supervisor", "director"];
export const STATUSES: readonly PeopleStatus[] = ["active", "terminated", "all"];
export const ROSTER_TABS: readonly RosterTab[] = ["people", "stores", "areas", "import"];

/** Rows per page on the People tab. */
export const PEOPLE_PAGE_SIZE = 25;
/** The API's limit on a search (GET /portal/people `q`). */
const MAX_SEARCH = 80;

const pick = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined =>
  value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

/** The tab in `?tab=`; People when it is missing or not one of them. */
export function rosterTab(query: Query): RosterTab {
  return pick(ROSTER_TABS, readString(query, "tab")) ?? "people";
}

export interface PeopleFilters {
  role?: Role;
  /** The store's number, as the rest of the portal keeps it in the URL (OP-01: `?store=2741`). */
  store?: string;
  status: PeopleStatus;
  q?: string;
  /** The first row of the page, a multiple of the page size. */
  offset: number;
}

/** The People filters in the URL; anything unknown is ignored rather than refused. */
export function peopleFilters(query: Query, size = PEOPLE_PAGE_SIZE): PeopleFilters {
  const q = readString(query, "q")?.trim().slice(0, MAX_SEARCH);
  const offset = readNumber(query, "offset", 0);
  return {
    role: pick(ROLES, readString(query, "role")),
    store: readString(query, "store")?.trim() || undefined,
    status: pick(STATUSES, readString(query, "status")) ?? "active",
    q: q || undefined,
    offset: offset - (offset % size),
  };
}

export type PeopleApiQuery = {
  role?: Role;
  store?: string;
  q?: string;
  status: PeopleStatus;
  page: number;
  page_size: number;
};

/**
 * GET /portal/people's query for these filters. The URL names a store by its number; the API
 * wants its id, so the number is looked up in the operator's stores (an unknown number filters
 * nothing rather than everything).
 */
export function peopleApiQuery(
  filters: PeopleFilters,
  stores: ReadonlyArray<Pick<Schemas["StoreOut"], "id" | "number">>,
  size = PEOPLE_PAGE_SIZE,
): PeopleApiQuery {
  const store = filters.store
    ? stores.find((candidate) => candidate.number.toLowerCase() === filters.store!.toLowerCase())
    : undefined;
  const query: PeopleApiQuery = {
    status: filters.status,
    page: Math.floor(filters.offset / size) + 1,
    page_size: size,
  };
  if (filters.role) query.role = filters.role;
  if (store) query.store = store.id;
  if (filters.q) query.q = filters.q;
  return query;
}

/** The offset of the last page that has rows, for a page number past the end (a filter
 *  shrank the list, a bookmark aged); null when the offset asked for is fine as it is. */
export function lastPageOffset(offset: number, total: number, size = PEOPLE_PAGE_SIZE): number | null {
  if (total === 0 || offset < total) return null;
  return Math.floor((total - 1) / size) * size;
}
