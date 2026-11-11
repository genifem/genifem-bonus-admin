import Link from "next/link";

import { cx } from "./cx";
import { withQuery, type Query } from "./query";

/** Paging as two links, so the list page stays a Server Component.
 *
 *  `total` is optional because the roster endpoint returns a bare array and does not report
 *  one; without it this says "Showing 51–100" and offers Next until a short page comes back.
 *  Pass `total` and it becomes "51–100 of 328". */
export function Pagination({
  query,
  offset,
  limit,
  count,
  total,
  labels,
  className,
}: {
  query: Query;
  offset: number;
  limit: number;
  /** How many rows this page actually returned. */
  count: number;
  total?: number;
  labels: { previous: string; next: string; range: string; label: string };
  className?: string;
}) {
  const last = offset + count;
  const hasPrevious = offset > 0;
  // Without a total, a full page is the only hint that there may be more.
  const hasNext = total === undefined ? count === limit : last < total;

  // Secondary buttons, as Button draws them; a dead end is drawn, not hidden, so the
  // pair never jumps about.
  const base =
    "inline-flex h-11 items-center rounded-lg border px-4 text-caption font-bold";
  const link = cx(base, "border-button-border bg-surface-raised hover:bg-background");
  const dead = cx(base, "border-border bg-surface text-muted");

  return (
    <nav aria-label={labels.label} className={cx("flex flex-wrap items-center justify-between gap-3", className)}>
      <p className="text-caption font-semibold text-muted tabular-nums">{labels.range}</p>
      <div className="flex gap-2">
        {hasPrevious ? (
          <Link href={withQuery(query, { offset: Math.max(0, offset - limit) })} className={link}>
            {labels.previous}
          </Link>
        ) : (
          <span className={dead} aria-disabled="true">
            {labels.previous}
          </span>
        )}
        {hasNext ? (
          <Link href={withQuery(query, { offset: offset + limit })} className={link}>
            {labels.next}
          </Link>
        ) : (
          <span className={dead} aria-disabled="true">
            {labels.next}
          </span>
        )}
      </div>
    </nav>
  );
}
