import { cx } from "./cx";
import { NavLink } from "./NavLink";

export interface TabItem {
  key: string;
  label: string;
  href: string;
  /** How many records this view holds, drawn after the label ("Overdue 2"). */
  count?: number;
}

/**
 * Tabs that are links, with the current one in the URL - drawn as the prototype's pill tabs
 * (`.o-tabs`: 34px pills, the current one filled with ink, white words).
 *
 * Deliberately not the ARIA tab widget: these navigate, so they are a set of links and are
 * marked up as navigation with aria-current. Calling them `role="tablist"` would promise a
 * screen reader arrow-key behaviour between panels that exist on the same page, which is not
 * what happens here — and it would mean shipping the JavaScript to deliver it.
 *
 * The payoff is that a tab is shareable, the back button works, and each tab renders on the
 * server with only the data it needs. Following one swaps the page in place rather than
 * loading a new document; the page renders again, so `current` (which it works out, defaults
 * included) is always the one on screen.
 *
 * Too many for one line (a phone, Spanish), they wrap rather than scroll sideways out of view;
 * the lines sit far enough apart that the enlarged hit areas do not overlap.
 */
export function Tabs({
  items,
  current,
  label,
  className,
}: {
  items: readonly TabItem[];
  current: string;
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={cx("min-w-0 max-w-full", className)}>
      <ul className="relative flex flex-wrap gap-x-1.5 gap-y-2.5">
        {items.map((item) => (
          <li key={item.key} className="shrink-0">
            <NavLink
              href={item.href}
              active={item.key === current}
              // 34px drawn, inside a 44px hit area (NF-11).
              className="relative flex h-8.5 items-center gap-1 whitespace-nowrap rounded-full border px-3.25 text-caption font-extrabold transition-colors duration-fast ease-standard before:absolute before:inset-x-0 before:-inset-y-1.25 before:content-['']"
              activeClassName="border-foreground bg-foreground text-surface-raised"
              inactiveClassName="border-button-border bg-surface-raised text-muted hover:text-foreground"
            >
              {item.label}
              {item.count !== undefined ? <span className="tabular-nums">{item.count}</span> : null}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
