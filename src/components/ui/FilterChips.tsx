import Link from "next/link";

import { cx } from "./cx";

export interface FilterChip {
  /** Stable key, also how the caller says which chip is on. */
  key: string;
  label: string;
  /** Shown after the label; left out when undefined. */
  count?: number;
  /** The page with this filter applied: the filter lives in the URL, so a chip is a link. */
  href: string;
}

/**
 * A row of filter chips that are links (a redemption status, a role): the filter is in the URL, so
 * the page stays a Server Component, the back button undoes a filter and a shared link opens
 * on the same view. The chip that is on carries aria-current, which a screen reader announces.
 *
 * Drawn 36px tall on a phone and 40px from 1024px; an invisible edge takes the touch
 * target to 44px. The row wraps onto a second line rather than scrolling sideways: a row
 * that scrolls with its bar hidden cannot be seen to hold more, and on a desk only a
 * trackpad or shift-and-wheel reaches the rest.
 */
export function FilterChips({
  label,
  chips,
  active,
  className,
}: {
  /** Names the group for assistive technology, e.g. "Filter modules". */
  label: string;
  chips: readonly FilterChip[];
  active: string;
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <nav aria-label={label} className={cx("min-w-0", className)}>
      <ul className="m-0 flex list-none flex-wrap gap-x-2 gap-y-2.5 p-0">
        {chips.map((chip) => {
          const on = chip.key === active;
          return (
            <li key={chip.key} className="shrink-0">
              <Link
                href={chip.href}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-caption font-bold lg:h-10 lg:px-4 lg:text-sm",
                  "before:absolute before:inset-x-0 before:-inset-y-1 before:content-[''] lg:before:-inset-y-0.5",
                  on
                    ? "bg-foreground text-white"
                    : "border border-button-border bg-surface-raised text-foreground hover:bg-background",
                )}
              >
                {chip.label}
                {chip.count !== undefined ? <span className="tabular-nums">{chip.count}</span> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
