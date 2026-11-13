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
  /**
   * Drops a low-priority column from the full table while the table itself is narrower than
   * this, so what matters fits without scrolling sideways: md 896px, lg 1024px, xl 1280px.
   * Measured on the table, not the window: the same table is narrower beside an open rail than
   * a folded one. The stacked cards have room for it again and show it, unless `stack: "hide"`;
   * `sm` drops it from the stacked cards only.
   */
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
  /**
   * In the stacked cards: `full` takes a line of its own on a phone-width card, for what does
   * not fit half of one (a field with its unit, a long text); `hide` leaves the column out.
   * Unset, it shares a line with the next.
   */
  stack?: "full" | "hide";
  cell: (row: Row) => React.ReactNode;
}

/*
 * The two layouts are the `spread` (full table) and `stacked` (cards) variants in globals.css,
 * which read the table's own width; the class names are written out in full because Tailwind
 * finds them by reading the source. Unnamed container queries (`@max-5xl:`) also read the
 * table's box, the nearest container to every cell.
 */

/** A pinned cell is opaque, so the columns scrolling under it do not show through; on a
 *  hovered row it takes the row's tint, mixed to the same colour. Only in the full table: the
 *  cards never scroll sideways. */
const pinEdge = "spread:shadow-[-1px_0_0_var(--color-border)]";
const pinnedCell = cx(
  "spread:sticky spread:right-0 spread:z-1 spread:bg-surface-raised",
  pinEdge,
  "spread:group-hover/row:bg-[color-mix(in_srgb,var(--color-background)_60%,var(--color-surface-raised))]",
);

/** The full table's column priorities: only ever with `spread:`, so they never meet the cards'
 *  own display rule. */
const hide = {
  sm: "",
  md: "spread:@max-4xl:hidden",
  lg: "spread:@max-5xl:hidden",
  xl: "spread:@max-7xl:hidden",
};

const overflow = {
  truncate: "max-w-64 truncate",
  wrap: "break-words spread:min-w-40 spread:max-w-80",
  nowrap: "whitespace-nowrap",
};

const width = {
  min: "spread:w-px spread:whitespace-nowrap",
  sm: "spread:min-w-32",
  md: "spread:min-w-48",
  lg: "spread:min-w-64",
};

/** A row as a card: the first column as its title across the top, the rest as labelled
 *  fields two to a line on a phone and three on a card 576px wide or more (a tablet, a page
 *  beside an open rail), the actions on a line of their own at the foot. */
const cardRow =
  "stacked:grid stacked:grid-cols-2 stacked:gap-x-4 stacked:gap-y-3 stacked:px-4.5 stacked:py-3.5 stacked:@xl:grid-cols-3";
const cardCell = "stacked:min-w-0 stacked:max-w-none stacked:p-0 stacked:text-left";
const cardLine = "stacked:col-span-full";
const cardWide = "stacked:col-span-full stacked:@xl:col-span-1";

/**
 * A real table: one header row, one row per record, alignment that suits the
 * data, and sorting that is a plain link.
 *
 * Nothing here is client-side. Sorting and filtering live in the URL, so the page that renders
 * this can stay a Server Component and cost the browser nothing — which is what the card lists
 * were already doing, except they could not hold 200 people.
 *
 * It fits the room it is given rather than the window: it is its own size container. Wide
 * enough (768px, or `stackBelow` 960 for a table of fields), it is the full table, its edges in
 * line with the card around it, and the columns marked `hideBelow` give way first as it
 * narrows. Narrower (a phone, a tablet, a page beside an open rail) each row becomes a card:
 * the first cell as its title, every other column as a labelled field, the actions at the
 * foot - all of it on screen, nothing behind a sideways scroll. The rows keep their table roles
 * (set explicitly, since a browser can drop them once the cells stop displaying as cells), so a
 * screen reader still reads a table with its column headers.
 *
 * Should a full table still be too wide, it scrolls sideways inside its own box rather than
 * pushing the page wide; the box is focusable and named so a keyboard can reach the scroll
 * (NF-11).
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
  stackBelow = 768,
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
  /** The table width under which rows become cards: 960 for a table of form fields or many
   *  columns, which needs that much for its full layout. */
  stackBelow?: 768 | 960;
  className?: string;
}) {
  // As cards, the header row is not drawn; a sortable table keeps its sort links in view as a
  // row of their own instead.
  const sortable = Boolean(query) && columns.some((column) => column.sortable);
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      style={stickyHeader ? { maxHeight: stickyHeader.maxHeight } : undefined}
      className={cx(
        stackBelow === 960 ? "@container/table-wide" : "@container/table",
        stickyHeader ? "relative overflow-auto overscroll-contain" : "relative overflow-x-auto",
        !bare && "rounded-2xl border border-border bg-surface-raised",
        className,
      )}
    >
      <table role="table" className="w-full border-collapse text-left stacked:block">
        <caption className="sr-only">{caption}</caption>
        <thead role="rowgroup" className={sortable ? "stacked:block" : "stacked:sr-only"}>
          <tr
            role="row"
            className={
              sortable
                ? "stacked:flex stacked:flex-wrap stacked:gap-x-3 stacked:border-b stacked:border-border stacked:px-3"
                : undefined
            }
          >
            {columns.map((column) => {
              const sorted = sort === column.key;
              const next: SortDirection = sorted && direction === "asc" ? "desc" : "asc";
              return (
                <th
                  key={column.key}
                  role="columnheader"
                  scope="col"
                  // aria-sort belongs on the header cell, not the link inside it.
                  aria-sort={sorted ? (direction === "asc" ? "ascending" : "descending") : undefined}
                  className={cx(
                    // The prototype's `.o-table` headers: 11px uppercase muted over a hairline,
                    // as far in as the cells under them, the outer ones in line with the card.
                    // A long one wraps (on the line of the data under it) rather than setting
                    // its column's width: Spanish headers run long.
                    "border-b border-border bg-surface-raised px-3 py-2 align-bottom text-2xs font-black uppercase tracking-wide text-muted",
                    "spread:first:pl-4.5 spread:last:pr-4.5",
                    // The hairline is drawn as a shadow when stuck: a collapsed border does not
                    // travel with a sticky cell.
                    stickyHeader && "sticky top-0 z-10 shadow-[inset_0_-1px_0_var(--color-border)]",
                    column.align === "end" && "text-right",
                    column.width && width[column.width],
                    column.hideBelow && hide[column.hideBelow],
                    column.pin && (stickyHeader ? "spread:right-0 spread:z-20" : "spread:sticky spread:right-0 spread:z-1"),
                    column.pin && pinEdge,
                    sortable &&
                      (column.sortable ? "stacked:block stacked:border-0 stacked:px-1" : "stacked:hidden"),
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
                      <span aria-hidden="true">{sorted ? (direction === "asc" ? "↑" : "↓") : ""}</span>
                    </Link>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody role="rowgroup" className="stacked:block">
          {rows.length === 0 && empty ? (
            <tr role="row" className="stacked:block">
              <td role="cell" colSpan={columns.length} className="p-3.5 spread:px-4.5 stacked:block stacked:px-4.5">
                {empty}
              </td>
            </tr>
          ) : null}
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              role="row"
              className={cx(
                "group/row border-b border-border transition-colors duration-fast hover:bg-background/60",
                !bare && "last:border-b-0",
                cardRow,
              )}
            >
              {columns.map((column, index) => {
                // As a card: the first column is its title and the pinned one its actions, each
                // on a line of its own and neither labelled (each says what it is).
                const title = index === 0;
                const actions = column.pin === "end";
                const shown = column.stack !== "hide" && column.hideBelow !== "sm";
                return (
                  <td
                    key={column.key}
                    role="cell"
                    title={column.overflow === "truncate" ? column.cellTitle?.(row) : undefined}
                    className={cx(
                      "px-3 py-3.5 align-middle text-sm spread:first:pl-4.5 spread:last:pr-4.5",
                      column.align === "end" && "text-right tabular-nums",
                      column.overflow && overflow[column.overflow],
                      column.width && width[column.width],
                      column.hideBelow && hide[column.hideBelow],
                      column.pin && pinnedCell,
                      cardCell,
                      shown ? "stacked:block" : "stacked:hidden",
                      (title || actions) && cardLine,
                      !title && !actions && column.stack === "full" && cardWide,
                    )}
                  >
                    {!title && !actions ? (
                      // The column's name over its value, on the cards only; a screen reader
                      // has the real header cell.
                      <span
                        aria-hidden="true"
                        className="mb-1 hidden text-2xs font-black uppercase tracking-wide text-muted stacked:block"
                      >
                        {column.header}
                      </span>
                    ) : null}
                    {column.cell(row)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
