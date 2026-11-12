// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that the server page, the client list and the unit tests all use.
import { readString, withQuery, type Query } from "@/components/ui/query";

/**
 * The audit log (NF-09) keeps its filters in the URL like every list in the portal: the kind of
 * change (`?kind=settings`) and one record's history (`?target=<id>`, from a person's row on
 * Roster). Paging is a cursor the API hands back (`next_before`), so it is not in the URL: the
 * first page is the server's, and "Load more" asks the BFF for the next from the browser.
 * Pure, so it can be tested on its own.
 */

/** The API's kinds of change (GET /portal/audit?kind=), in the order the chips show them. */
export const AUDIT_KINDS = ["settings", "rewards", "requests", "recognition", "roster", "awards", "sign_in"] as const;
export type AuditKind = (typeof AUDIT_KINDS)[number];

/** Entries per page; the API takes up to 100 and sends 50 by default. */
export const AUDIT_PAGE_SIZE = 50;

/** A Mongo id, which is all `target_id` takes: anything else would be a 422. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface AuditState {
  kind: AuditKind | null;
  /** The record whose history is shown (a person, a store, a reward...). */
  target: string | null;
}

/** What the URL asks for. A kind or an id the API would refuse is left out rather than sent. */
export function auditState(query: Query): AuditState {
  const kind = readString(query, "kind");
  const target = readString(query, "target")?.trim();
  return {
    kind: (AUDIT_KINDS as readonly string[]).includes(kind ?? "") ? (kind as AuditKind) : null,
    target: target && OBJECT_ID.test(target) ? target.toLowerCase() : null,
  };
}

export type AuditApiQuery = {
  limit: number;
  kind?: AuditKind;
  target_id?: string;
  before?: string;
};

/** GET /portal/audit's query: the filters, and `before` (the last page's `next_before`) for
 *  the page after it. */
export function auditApiQuery(state: AuditState, before?: string | null, limit = AUDIT_PAGE_SIZE): AuditApiQuery {
  const query: AuditApiQuery = { limit };
  if (state.kind) query.kind = state.kind;
  if (state.target) query.target_id = state.target;
  if (before) query.before = before;
  return query;
}

/** The same query as a path under the BFF (lib/api.ts adds /api/v1), for "Load more". */
export function auditPath(state: AuditState, before?: string | null, limit = AUDIT_PAGE_SIZE): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(auditApiQuery(state, before, limit))) params.set(key, String(value));
  return `/portal/audit?${params.toString()}`;
}

/** A kind chip's own URL (null: every kind). One record's history stays on. */
export function kindHref(query: Query, kind: AuditKind | null): string {
  return `/audit${withQuery(query, { kind })}`;
}

/** Everyone's changes again, keeping the kind. */
export function everyoneHref(query: Query): string {
  return `/audit${withQuery(query, { target: null })}`;
}

/** One record's history, from a row elsewhere in the portal (Roster's people). */
export function historyHref(id: string): string {
  return `/audit${withQuery({}, { target: id })}`;
}
