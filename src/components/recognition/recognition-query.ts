import type { Schemas } from "@crewstars/api-client";

// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that the server pages and the unit tests both use as plain logic.
import { readNumber, readString, type Query } from "@/components/ui/query";

/**
 * The Recognize and Stores & people pages keep their state in the URL, like every list in the
 * portal: who is being recognized and how the list of people is filtered, or which people and
 * which page. Pure, so it can be tested on its own.
 */

export type Role = Schemas["CandidateOut"]["role"];

/** Most senior first, as the API orders people. */
export const ROLES: readonly Role[] = ["director", "supervisor", "gm", "shift", "crew"];

/** The role filter on Recognize anyone (OP-06). Leaders (directors, supervisors and GMs) is the
 *  default, so an owner never starts by scrolling through every crew member. */
export const CANDIDATE_FILTERS = ["leaders", "director", "supervisor", "gm", "shift", "crew", "everyone"] as const;
export type CandidateFilter = (typeof CANDIDATE_FILTERS)[number];
export const DEFAULT_FILTER: CandidateFilter = "leaders";

/** The API's limit on a name search. */
const MAX_SEARCH = 80;
/** A person's id as the API writes it (a Mongo ObjectId); anything else is not one. */
const PERSON_ID = /^[0-9a-f]{24}$/i;

const pick = <T extends string>(allowed: readonly T[], value: string | undefined): T | undefined =>
  value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

function search(query: Query): string | undefined {
  const q = readString(query, "q")?.trim().slice(0, MAX_SEARCH);
  return q || undefined;
}

export interface RecognizeState {
  /** The role filter the URL asks for; undefined when it asks for none. */
  filter?: CandidateFilter;
  /** The store filter as written (a store number). */
  store?: string;
  q?: string;
  /** Whoever is being recognized (`?to=`, from a Recognize button elsewhere). */
  to?: string;
}

export function recognizeState(query: Query): RecognizeState {
  const to = readString(query, "to")?.trim();
  const store = readString(query, "store")?.trim();
  return {
    filter: pick(CANDIDATE_FILTERS, readString(query, "filter")),
    store: store || undefined,
    q: search(query),
    to: to && PERSON_ID.test(to) ? to : undefined,
  };
}

/** The role filter that lists someone with this role: a leader among the leaders. */
export function filterForRole(role: Role): CandidateFilter {
  return role === "director" || role === "supervisor" || role === "gm" ? "leaders" : role;
}

/** The filter in force: the URL's, or the one that lists the person being recognized, or
 *  Leaders. */
export function activeFilter(state: RecognizeState, selectedRole?: Role): CandidateFilter {
  return state.filter ?? (selectedRole ? filterForRole(selectedRole) : DEFAULT_FILTER);
}

export type CandidatesApiQuery = { filter: CandidateFilter; store?: string; q?: string };

/** GET /portal/recognize/candidates's query; `storeId` is the API's id for the URL's store. */
export function candidatesApiQuery(filter: CandidateFilter, storeId?: string, q?: string): CandidatesApiQuery {
  const query: CandidatesApiQuery = { filter };
  if (storeId) query.store = storeId;
  if (q) query.q = q;
  return query;
}

/** Rows per page on Stores & people. */
export const TEAM_PAGE_SIZE = 25;

export interface TeamFilters {
  role?: Role;
  q?: string;
  /** The first row of the page, a multiple of the page size. */
  offset: number;
}

/** The people table's filters in the URL (OP-08); anything unknown is ignored. The store is
 *  the shared filter's (lib/store-scope.ts). */
export function teamFilters(query: Query, size = TEAM_PAGE_SIZE): TeamFilters {
  const offset = readNumber(query, "offset", 0);
  return { role: pick(ROLES, readString(query, "role")), q: search(query), offset: offset - (offset % size) };
}

export type TeamApiQuery = { store?: string; role?: Role; q?: string; page: number; page_size: number };

/** GET /portal/team's query: the offset in the URL becomes a page number. */
export function teamApiQuery(filters: TeamFilters, storeId?: string, size = TEAM_PAGE_SIZE): TeamApiQuery {
  const query: TeamApiQuery = { page: Math.floor(filters.offset / size) + 1, page_size: size };
  if (storeId) query.store = storeId;
  if (filters.role) query.role = filters.role;
  if (filters.q) query.q = filters.q;
  return query;
}
