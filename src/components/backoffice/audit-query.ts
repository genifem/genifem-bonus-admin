// Straight from the file rather than the ui index, which would bring every component (and
// React) into a module that the server page and the unit tests both use.
import { readString, withQuery, type Query } from "@/components/ui/query";

/**
 * The back office's audit log (P7) keeps its filters in the URL like every list in the portal:
 * one operator (`?operator=<id>`), one admin (`?actor=<id>`), and a kind of action
 * (`?action=owner.` - the API takes a prefix). Paging is the cursor the API hands back
 * (`next_before`), carried as `?before=<id>`: "Older" follows it, "Newest" drops it. Pure, so
 * it can be tested on its own.
 */

/** The kinds of action the chips offer, as the prefixes the API matches. */
export const AUDIT_ACTIONS = ["operator.", "owner.", "staff.", "auth.", "mfa.", "platform.denied"] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

/** Entries per page; the API takes up to 100. */
export const AUDIT_PAGE_SIZE = 40;

/** A Mongo id, which is all the API's id filters take: anything else would be a 422. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface AuditState {
  operator: string | null;
  actor: string | null;
  action: AuditAction | null;
  before: string | null;
}

const idOf = (query: Query, key: string) => {
  const value = readString(query, key)?.trim();
  return value && OBJECT_ID.test(value) ? value.toLowerCase() : null;
};

/** What the URL asks for. A value the API would refuse is left out rather than sent. */
export function auditState(query: Query): AuditState {
  const action = readString(query, "action");
  return {
    operator: idOf(query, "operator"),
    actor: idOf(query, "actor"),
    action: (AUDIT_ACTIONS as readonly string[]).includes(action ?? "") ? (action as AuditAction) : null,
    before: idOf(query, "before"),
  };
}

export interface AuditApiQuery {
  limit: number;
  operator_id?: string;
  actor_id?: string;
  action?: string;
  before?: string;
}

/** GET /platform/audit's query. */
export function auditApiQuery(state: AuditState, limit = AUDIT_PAGE_SIZE): AuditApiQuery {
  const query: AuditApiQuery = { limit };
  if (state.operator) query.operator_id = state.operator;
  if (state.actor) query.actor_id = state.actor;
  if (state.action) query.action = state.action;
  if (state.before) query.before = state.before;
  return query;
}

/** A kind chip's own URL (null: every kind). Changing the filter starts from the newest. */
export function actionHref(query: Query, action: AuditAction | null): string {
  return `/audit${withQuery(query, { action, before: null })}`;
}

/** The page after this one: older entries, from the cursor the API gave. */
export function olderHref(query: Query, nextBefore: string): string {
  return `/audit${withQuery(query, { before: nextBefore })}`;
}

/** Back to the newest entries, keeping the filters. */
export function newestHref(query: Query): string {
  return `/audit${withQuery(query, { before: null })}`;
}
