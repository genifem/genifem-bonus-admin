import Link from "next/link";

import { cx } from "./cx";
import { ringInside } from "./focus";
import { withQuery, type Query } from "./query";

export type SortDirection = "asc" | "desc";

export interface Column<Row> {
  key: string;
  header: string;
  /** Numbers and dates read better flush right; everything else stays left. */
  align?: "start" | "end";
  /** Sorting is a link, handled by the server. Omit for columns the API cannot sort. */
  sortable?: boolean;
  /** Drops the column on narrow screens so a phone shows what matters, not everything. */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /**
   * How the column treats long content. Unset, it sizes to what it holds.
   *   truncate  one line with an ellipsis; give the cell a `title` (see cellTitle) so the rest
   *             can still be read
   *   wrap      breaks long names, emails and titles instead of widening the table
   *   nowrap    never breaks (dates, codes, a row of actions)
   */
  overflow?: "truncate" | "wrap" | "nowrap";
  /** The full text of a truncated cell, shown on hover. */
  cellTitle?: (row: Row) => string | undefined;
  /** `min` shrinks the column to its content (an actions column). */
  width?: "min" | "sm" | "md" | "lg";
  /** Pinned to the right edge while the rest scrolls sideways under it, with a hairline on its
   *  left: a row's actions stay in reach on a desk too narrow for every column. */
  pin?: "end";
  cell: (row: Row) => React.ReactNode;
}

/** A pinned cell is opaque, so the columns scrolling under it do not show through; on a
 *  hovered row it takes the row's tint, mixed to the same colour. */
const pinEdge = "shadow-[-1px_0_0_var(--color-border)]";
const pinnedCell = cx(
  "sticky right-0 z-1 bg-surface-raised",
  pinEdge,
  "group-hover/row:bg-[color-mix(in_srgb,var(--color-background)_60%,var(--color-surface-raised))]",
);

const hide = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
  xl: "hidden xl:table-cell",
};

const overflow = {
  truncate: "max-w-64 truncate",
  wrap: "min-w-40 max-w-80 break-words",
  nowrap: "whitespace-nowrap",
};

const width = { min: "w-px whitespace-nowrap", sm: "min-w-32", md: "min-w-48", lg: "min-w-64" };

/**
 * A real table: one header row, one row per record, alignment that suits the
 * data, and sorting that is a plain link.
 *
 * Nothing here is client-side. Sorting and filtering live in the URL, so the page that renders
 * this can stay a Server Component and cost the browser nothing — which is what the card lists
 * were already doing, except they could not hold 200 people.
 *
 * On a narrow screen the table scrolls sideways inside its own box rather than pushing the
 * page wide; the box is focusable and named so a keyboard can reach the scroll (NF-11).
 */
export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  query,
  sort,
  direction = "asc",
  sortLabel,
  bare = false,
  empty,
  stickyHeader,
  className,
}: {
  /** Names the table for a screen reader. Visually hidden. */
  caption: string;
  columns: ReadonlyArray<Column<Row>>;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  query?: Query;
  sort?: string;
  direction?: SortDirection;
  /** e.g. "Sort by {column}" — the accessible name of a header link. */
  sortLabel?: (column: string) => string;
  /** Drops the card around the table, for a table that already sits in one (the crew card). */
  bare?: boolean;
  /** One full-width row in place of the rows when there are none: why, and what to do. */
  empty?: React.ReactNode;
  /** Keeps the header in view while a long table scrolls inside a box of this height. A
   *  sticky header can only stick inside the box that scrolls, so it needs the height. */
  stickyHeader?: { maxHeight: string };
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      style={stickyHeader ? { maxHeight: stickyHeader.maxHeight } : undefined}
      className={cx(
        stickyHeader ? "relative overflow-auto" : "relative overflow-x-auto",
        !bare && "rounded-2xl border border-border bg-surface-raised",
        className,
      )}
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const sorted = sort === column.key;
              const next: SortDirection = sorted && direction === "asc" ? "desc" : "asc";
              return (
                <th
                  key={column.key}
                  scope="col"
                  // aria-sort belongs on the header cell, not the link inside it.
                  aria-sort={sorted ? (direction === "asc" ? "ascending" : "descending") : undefined}
                  className={cx(
                    // The prototype's `.o-table` headers: 11px uppercase muted over a hairline.
                    "whitespace-nowrap border-b border-border bg-surface-raised px-2.5 py-2 text-2xs font-black uppercase tracking-wide text-muted",
                    // The hairline is drawn as a shadow when stuck: a collapsed border does not
                    // travel with a sticky cell.
                    stickyHeader && "sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--color-border)]",
                    column.align === "end" && "text-right",
                    column.width && width[column.width],
                    column.hideBelow && hide[column.hideBelow],
                    column.pin && (stickyHeader ? "right-0 z-20" : "sticky right-0 z-1"),
                    column.pin && pinEdge,
                  )}
                >
                  {column.sortable && query ? (
                    <Link
                      href={withQuery(query, { sort: column.key, dir: next, offset: null })}
                      aria-label={sortLabel?.(column.header)}
                      className={cx(
                        "inline-flex min-h-6 items-center gap-1 rounded-sm transition-colors duration-fast hover:text-foreground",
                        ringInside,
                      )}
                    >
                      {column.header}
                      {/* The arrow repeats what aria-sort says; it is never the only signal. */}
                      <span aria-hidden="true">{sorted ? (direction === "asc" ? "\u2191" : "\u2193") : ""}</span>
                    </Link>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && empty ? (
            <tr>
              <td colSpan={columns.length} className="p-3.5">
                {empty}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx(
                "group/row border-b border-border transition-colors duration-fast hover:bg-background/60",
                !bare && "last:border-b-0",
              )}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  title={column.overflow === "truncate" ? column.cellTitle?.(row) : undefined}
                  className={cx(
                    "p-3.5 align-middle text-sm",
                    column.align === "end" && "text-right tabular-nums",
                    column.overflow && overflow[column.overflow],
                    column.width && width[column.width],
                    column.hideBelow && hide[column.hideBelow],
                    column.pin && pinnedCell,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
