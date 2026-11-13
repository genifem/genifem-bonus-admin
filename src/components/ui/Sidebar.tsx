import type { LucideIcon } from "lucide-react";

import { ScopedNavLink } from "@/components/console/ScopedNavLink";
import type { RailState } from "@/lib/rail";

import { NavLink } from "./NavLink";
import { RailFrame, RailStripFocus, RailTips, RailToggle } from "./RailControls";

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

/** The phone strip's id, for RailStripFocus. */
const STRIP_ID = "rail-strip";
/** The rail's id, for the toggle's aria-controls. */
const RAIL_ID = "portal-rail";

/**
 * The rows of the rail, grouped under the prototype's small uppercase labels.
 *
 * At the rail breakpoint (860px) and up it is a column; below it, the same links run as one
 * horizontal scroller and the group labels go (they still name each list for a screen reader
 * through aria-labelledby). Folded to its icons, a group's label becomes a short rule between
 * the groups, and stays the list's name. The current row is NavLink's to say, from the URL:
 * red-soft behind it and its words in the action red, never colour alone - it also carries
 * aria-current.
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
      <div
        id={STRIP_ID}
        className="scrollbar-hidden flex gap-1 overflow-x-auto px-3 py-2 rail:flex-col rail:gap-0 rail:overflow-visible rail:p-0"
      >
        {groups.map((group, index) => {
          // One rail per page, so the index is a unique enough id.
          const titleId = group.title ? `rail-group-${index}` : undefined;
          return (
            <div key={group.title ?? index} className="flex shrink-0 gap-1 rail:flex-col rail:gap-0.5">
              {index > 0 ? (
                <span aria-hidden="true" className="mx-auto my-2 hidden h-px w-6 bg-sidebar-border folded:block" />
              ) : null}
              {group.title ? (
                <p
                  id={titleId}
                  className="hidden truncate px-3 pb-1.5 pt-3 text-2xs font-black uppercase tracking-widest text-sidebar-muted rail:block folded:sr-only"
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

/** One row: the prototype's 12px-radius button shape, 800 weight, a 19px icon. Folded, the
 *  icon alone in a 48x44 square, its words kept for a screen reader and shown as a tooltip
 *  (RailTips) on hover and keyboard focus. */
function RailLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  const Link = item.scoped ? ScopedNavLink : NavLink;
  return (
    <Link
      href={item.href}
      exact={item.exact}
      data-rail-tip=""
      // One line in the phone strip, which scrolls; in the 240px rail a long label ("Registro de
      // auditoría" in a bigger text size) wraps rather than running under the edge.
      className="relative flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-compact px-2.5 text-caption font-extrabold transition-colors duration-fast rail:whitespace-normal rail:px-3 rail:py-1.5 rail:text-sm folded:justify-center folded:px-0"
      activeClassName="bg-sidebar-active-bg text-sidebar-active-fg"
      inactiveClassName="text-sidebar-fg hover:bg-sidebar-hover-bg"
    >
      {/* Decorative: the label beside it is the accessible name. */}
      <Icon aria-hidden="true" className="size-[19px] shrink-0" strokeWidth={2} />
      <span className="min-w-0 folded:sr-only">{item.label}</span>
      {item.badge !== undefined ? (
        <span className="ml-auto rounded-full bg-brand px-1.75 text-2xs font-extrabold tabular-nums text-brand-fg folded:absolute folded:right-0.5 folded:top-0.5 folded:ml-0 folded:px-1">
          {item.badge}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * The owner portal's frame (prototype `.o-app`): a white rail on the left - the lockup, the
 * grouped destinations, and who is signed in pinned to the foot - beside the cream page.
 *
 * The rail is 240px open or 72px folded to its icons (`rail`: the owner's choice from the
 * cookie, or "auto", lib/rail.ts); globals.css turns that into its width, and the page beside
 * it takes the rest, sliding with it (instantly with reduced motion). Inside the rail the
 * `folded` variant reads the rail's own width, so the words, the group labels and the account
 * card follow it without any script.
 *
 * Below 860px the rail folds into the top of the page: the lockup with `compactAccount` (the
 * way out) beside it, then the links as a sticky horizontal scroller, as the prototype does.
 *
 * The page column grows with the screen up to 1680px (`max-w-content`), centred in the room
 * the rail leaves, with side padding that grows with it (`px-gutter`). It is the `page`
 * container the layouts inside query, so a page re-flows when the rail folds or opens.
 */
export function Sidebar({
  brand,
  groups,
  label,
  account,
  foldedAccount,
  compactAccount,
  rail = "auto",
  toggleLabels,
  children,
}: {
  /** The lockup at the top. Its words should carry `folded:sr-only`, so a folded rail shows
   *  the mark alone. */
  brand: React.ReactNode;
  groups: readonly NavGroup[];
  label: string;
  /** Who is signed in and the way out, at the foot of the open rail (860px and up). */
  account?: React.ReactNode;
  /** The same in a folded rail: a small button that opens it. */
  foldedAccount?: React.ReactNode;
  /** The same, smaller, beside the lockup on a phone. */
  compactAccount?: React.ReactNode;
  rail?: RailState;
  toggleLabels: { collapse: string; expand: string };
  /** The page. */
  children: React.ReactNode;
}) {
  return (
    <RailFrame initial={rail} className="flex min-h-dvh flex-1 flex-col bg-background rail:flex-row">
      {/* `contents` below the breakpoint, so the link strip can stick to the top of the page
          on its own while the lockup scrolls away. From the breakpoint it is the `rail`
          container the folded styles read. */}
      <div
        id={RAIL_ID}
        data-rail-scroll=""
        className="contents rail:@container/rail rail:sticky rail:top-0 rail:flex rail:h-dvh rail:w-(--rail-w) rail:shrink-0 rail:flex-col rail:gap-1 rail:overflow-y-auto rail:overflow-x-hidden rail:overscroll-contain rail:border-r rail:border-sidebar-border rail:bg-sidebar-bg rail:px-3 rail:py-4.5 rail:transition-[width] rail:duration-base rail:ease-standard"
      >
        <div className="flex items-center gap-3 bg-sidebar-bg px-4 pb-1 pt-3 rail:min-h-11 rail:gap-1 rail:bg-transparent rail:pb-2 rail:pl-3 rail:pr-0 rail:pt-0 folded:flex-col folded:gap-2 folded:px-0">
          <div className="min-w-0 flex-1 folded:flex-none">{brand}</div>
          <RailToggle
            controls={RAIL_ID}
            collapseLabel={toggleLabels.collapse}
            expandLabel={toggleLabels.expand}
            className="hidden rail:flex"
          />
          {compactAccount ? <div className="flex shrink-0 items-center gap-2 rail:hidden">{compactAccount}</div> : null}
        </div>
        <RailNav
          groups={groups}
          label={label}
          className="sticky top-0 z-10 border-b border-sidebar-border bg-sidebar-bg rail:static rail:border-b-0"
        />
        {account ? <div className="hidden rail:mt-auto rail:block rail:pt-4 folded:hidden">{account}</div> : null}
        {foldedAccount ? (
          <div className="hidden folded:mt-auto folded:flex folded:justify-center folded:pt-4">{foldedAccount}</div>
        ) : null}
        <RailTips />
        <RailStripFocus strip={STRIP_ID} />
      </div>

      <main data-density="console" className="flex min-w-0 flex-1 flex-col px-gutter">
        {/* The page column: 22px down on a phone, more on a desk, and no wider than 1680. */}
        <div className="@container/page mx-auto flex w-full min-w-0 max-w-content flex-1 flex-col gap-section pb-15 pt-5.5 rail:pt-6 2xl:pt-8">
          {children}
        </div>
      </main>
    </RailFrame>
  );
}
