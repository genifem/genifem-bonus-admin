import { readNumber, type Query } from "./query";

/** Rows per page in every console and back-office table. */
export const PAGE_SIZE = 25;

export interface Page<Row> {
  rows: Row[];
  offset: number;
  size: number;
  total: number;
}

/**
 * One page of a list the page already holds - filtered and sorted first, so the counts and
 * the order are the whole list's. The page is `?offset=` in the URL, like every other list
 * state, so paging is a link and the list page stays a Server Component.
 *
 * An offset past the end (a filter shrank the list, a bookmark aged) lands on the last page
 * rather than an empty one.
 */
export function paginate<Row>(rows: readonly Row[], query: Query, size = PAGE_SIZE): Page<Row> {
  const total = rows.length;
  const requested = readNumber(query, "offset", 0);
  const lastStart = total === 0 ? 0 : Math.floor((total - 1) / size) * size;
  const offset = Math.min(requested - (requested % size), lastStart);
  return { rows: rows.slice(offset, offset + size), offset, size, total };
}
