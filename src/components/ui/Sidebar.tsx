import type { LucideIcon } from "lucide-react";

import { ScopedNavLink } from "@/components/console/ScopedNavLink";

import { NavLink } from "./NavLink";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Current on `href` itself only, not the pages under it - for an overview at "/". */
  exact?: boolean;
  /** Shown on the right of the row — a count worth noticing (requests waiting). */
  badge?: string | number;
  /** A page the store filter belongs to (OP-01): the link carries the store along. */
  scoped?: boolean;
}

export interface NavGroup {
  /** The uppercase label above the group ("Recognition", "Rules you set"). */
  title?: string;
  items: NavItem[];
}

/**
 * The rows of the rail, grouped under the prototype's small uppercase labels.
 *
 * At the rail breakpoint (860px) and up it is a column; below it, the same links run as one
 * horizontal scroller and the group labels go (they still name each list for a screen reader
 * through aria-labelledby). The current row is NavLink's to say, from the URL: red-soft behind
 * it and its words in the action red, never colour alone - it also carries aria-current.
 */
export function RailNav({
  groups,
  label,
  className,
}: {
  groups: readonly NavGroup[];
  label: string;
  className?: string;
}) {
  return (
    <nav aria-label={label} className={className}>
      <div className="scrollbar-hidden flex gap-1 overflow-x-auto px-3 py-2 rail:flex-col rail:gap-0 rail:overflow-visible rail:p-0">
        {groups.map((group, index) => {
          // One rail per page, so the index is a unique enough id.
          const titleId = group.title ? `rail-group-${index}` : undefined;
          return (
            <div key={group.title ?? index} className="flex shrink-0 gap-1 rail:flex-col rail:gap-0.5">
              {group.title ? (
                <p
                  id={titleId}
                  className="hidden px-3 pb-1.5 pt-3 text-2xs font-black uppercase tracking-widest text-sidebar-muted rail:block"
                >
                  {group.title}
                </p>
              ) : null}
              <ul aria-labelledby={titleId} className="flex gap-1 rail:flex-col rail:gap-0.5">
                {group.items.map((item) => (
                  <li key={item.key} className="shrink-0">
                    <RailLink item={item} />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** One row: the prototype's 12px-radius button shape, 800 weight, a 19px icon. */
function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const Link = item.scoped ? ScopedNavLink : NavLink;
  return (
    <Link
      href={item.href}
      exact={item.exact}
      // One line in the phone strip, which scrolls; in the 240px rail a long label ("Registro de
      // auditoría" in a bigger text size) wraps rather than running under the edge.
      className="flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-compact px-2.5 text-caption font-extrabold transition-colors duration-fast rail:whitespace-normal rail:px-3 rail:py-1.5 rail:text-sm"
      activeClassName="bg-sidebar-active-bg text-sidebar-active-fg"
      inactiveClassName="text-sidebar-fg hover:bg-sidebar-hover-bg"
    >
      {/* Decorative: the label beside it is the accessible name. */}
      <Icon aria-hidden="true" className="size-[19px] shrink-0" strokeWidth={2} />
      {item.label}
      {item.badge !== undefined ? (
        <span className="ml-auto rounded-full bg-brand px-1.75 text-2xs font-extrabold tabular-nums text-brand-fg">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The owner portal's frame (prototype `.o-app`): a white 240px rail on the left - the lockup,
 * the grouped destinations, and who is signed in pinned to the foot - beside the cream page.
 *
 * Below 860px the rail folds into the top of the page: the lockup with `compactAccount` (the
 * way out) beside it, then the links as a sticky horizontal scroller, as the prototype does.
 * It renders on the server and holds no state; each row reads the URL for itself.
 */
export function Sidebar({
  brand,
  groups,
  label,
  account,
  compactAccount,
  children,
}: {
  /** The lockup at the top. */
  brand: React.ReactNode;
  groups: readonly NavGroup[];
  label: string;
  /** Who is signed in and the way out, at the foot of the rail (860px and up). */
  account?: React.ReactNode;
  /** The same, smaller, beside the lockup on a phone. */
  compactAccount?: React.ReactNode;
  /** The page. */
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background rail:flex-row">
      {/* `contents` below the breakpoint, so the link strip can stick to the top of the page
          on its own while the lockup scrolls away. */}
      <div className="contents rail:sticky rail:top-0 rail:flex rail:h-dvh rail:w-60 rail:shrink-0 rail:flex-col rail:gap-1 rail:overflow-y-auto rail:border-r rail:border-sidebar-border rail:bg-sidebar-bg rail:px-3 rail:py-4.5">
        <div className="flex items-center gap-3 bg-sidebar-bg px-4 pb-1 pt-3 rail:bg-transparent rail:px-3 rail:pb-2 rail:pt-0">
          <div className="min-w-0 flex-1">{brand}</div>
          {compactAccount ? <div className="flex shrink-0 items-center gap-2 rail:hidden">{compactAccount}</div> : null}
        </div>
        <RailNav
          groups={groups}
          label={label}
          className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar-bg rail:static rail:border-b-0"
        />
        {account ? <div className="hidden rail:mt-auto rail:block rail:pt-4">{account}</div> : null}
      </div>

      <main data-density="console" className="flex min-w-0 flex-1 flex-col">
        {/* The prototype's page column: 22px down, 28px in on a desk, and no wider than 1180. */}
        <div className="flex w-full min-w-0 max-w-295 flex-1 flex-col gap-4.5 px-4 pb-15 pt-5.5 rail:px-7">
          {children}
        </div>
      </main>
    </div>
  );
}
