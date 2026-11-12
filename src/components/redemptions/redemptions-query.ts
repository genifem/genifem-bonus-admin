import type { Schemas } from "@crewstars/api-client";

// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that the server page and the unit tests both use as plain logic.
import { readNumber, readString, withQuery, type Query } from "@/components/ui/query";

/**
 * Redemptions (OP-09) keeps its state in the URL like every list in the portal: the tab
 * (`?status=approved`; Waiting is the default and has none), the page, and the shared store
 * filter (lib/store-scope.ts). Also here: who decided a request, and what can still be done
 * to it, as plain data. Pure, so it can be tested on its own.
 */

type RequestRow = Schemas["RequestRow"];
export type RequestStatus = RequestRow["status"];

export const TABS = ["pending", "approved", "declined", "all"] as const;
export type RedemptionTab = (typeof TABS)[number];
export const DEFAULT_TAB: RedemptionTab = "pending";

/** Rows per page. */
export const REQUESTS_PAGE_SIZE = 25;

export interface RedemptionsState {
  tab: RedemptionTab;
  /** The first row of the page, a multiple of the page size. */
  offset: number;
}

export function redemptionsState(query: Query, size = REQUESTS_PAGE_SIZE): RedemptionsState {
  const raw = readString(query, "status");
  const tab = (TABS as readonly string[]).includes(raw ?? "") ? (raw as RedemptionTab) : DEFAULT_TAB;
  const offset = readNumber(query, "offset", 0);
  return { tab, offset: offset - (offset % size) };
}

export type RedemptionsApiQuery = {
  status: RedemptionTab;
  page: number;
  page_size: number;
  store?: string;
};

/** GET /portal/redemptions's query; `storeId` is the API's id for the URL's store. */
export function redemptionsApiQuery(
  state: RedemptionsState,
  storeId?: string,
  size = REQUESTS_PAGE_SIZE,
): RedemptionsApiQuery {
  const query: RedemptionsApiQuery = {
    status: state.tab,
    page: Math.floor(state.offset / size) + 1,
    page_size: size,
  };
  if (storeId) query.store = storeId;
  return query;
}

/** A tab's own URL: the store filter rides along, the page starts again. */
export function tabHref(query: Query, tab: RedemptionTab): string {
  return `/redemptions${withQuery(query, { status: tab === DEFAULT_TAB ? null : tab, offset: null })}`;
}

/**
 * Who decided a request (OP-09), as the table says it: a manager by name, an owner by name, or
 * nobody - "Automatic", when manager approval was off and it was approved the moment it was
 * made. Null while it waits. A name the API no longer has (someone since removed) is null.
 */
export type Decider =
  | { kind: "automatic" }
  | { kind: "owner"; name: string | null }
  | { kind: "manager"; name: string | null };

export function deciderOf(row: Pick<RequestRow, "decided_by">): Decider | null {
  const by = row.decided_by;
  if (!by) return null;
  if (by.kind === "system") return { kind: "automatic" };
  if (by.kind === "owner") return { kind: "owner", name: by.name };
  return { kind: "manager", name: by.name };
}

export type RequestAction = "approve" | "decline" | "collect";

/** What an owner can still do to a request: approve or decline one that waits, mark an
 *  approved one collected (plan G5). The rest are settled. */
export function actionsFor(status: RequestStatus): readonly RequestAction[] {
  if (status === "pending") return ["decline", "approve"];
  if (status === "approved") return ["collect"];
  return [];
}

/** Whether a tab can hold a row with something left to do, so the table needs the column. */
export function tabHasActions(tab: RedemptionTab): boolean {
  return tab !== "declined";
}
