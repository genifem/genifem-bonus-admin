"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, type ComponentProps } from "react";

import { cx } from "./cx";

type LinkProps = Omit<ComponentProps<typeof Link>, "href" | "className" | "aria-current">;

export interface NavLinkProps extends LinkProps {
  /** The path, as every link in the app is written ("/rewards"). */
  href: string;
  /** Current on this path only, not on the pages under it. "/" is always exact. */
  exact?: boolean;
  /** For tabs kept in the query (`?tab=stores`): current only when the path is this one and
   *  the parameter has the href's value, with no parameter matching the tab that has none. */
  param?: string;
  /** For a caller that already knows (a page that worked out which filter it shows, defaults
   *  included): the URL is then not read at all. */
  active?: boolean;
  className?: string;
  activeClassName?: string;
  inactiveClassName?: string;
}

/**
 * A link that moves to another page without loading a new document, and knows whether it is
 * the page you are on.
 *
 * The portal's sidebar is drawn by a layout, and a layout is not rendered again when the page
 * inside it changes. So the current row cannot be decided on the server: it is read here, from
 * the URL, and follows every navigation.
 *
 * A path is current on itself and on the pages under it (/rewards also marks /rewards/<id>),
 * unless `exact`. The current link gets aria-current="page" and
 * `activeClassName`. Anything inside it that changes when current - an icon's weight, a dot -
 * is drawn on the server, so it styles itself off that attribute with a named group, e.g.
 * `group/nav` on the link and `group-aria-[current=page]/nav:block` on the dot.
 */
export function NavLink({ param, active, exact, ...props }: NavLinkProps) {
  if (active !== undefined) return <NavAnchor {...props} current={active} />;
  if (param) {
    // A page prerendered at build time has no query until it reaches the browser, and Next
    // requires a Suspense boundary above whatever reads it. Until then: drawn, not current.
    return (
      <Suspense fallback={<NavAnchor {...props} current={false} />}>
        <QueryNavLink {...props} param={param} />
      </Suspense>
    );
  }
  return <PathNavLink {...props} exact={exact} />;
}

type AnchorProps = Omit<NavLinkProps, "param" | "active" | "exact">;

function PathNavLink({ exact, ...props }: AnchorProps & { exact?: boolean }) {
  const here = usePathname();
  return <NavAnchor {...props} current={isCurrent(here, props.href, exact)} />;
}

function QueryNavLink({ param, ...props }: AnchorProps & { param: string }) {
  const here = usePathname();
  const query = useSearchParams();
  // Parsed against a throwaway origin: only the path and query of the short href matter.
  const target = new URL(props.href, "http://link.invalid");
  const current = here === target.pathname && query.get(param) === target.searchParams.get(param);
  return <NavAnchor {...props} current={current} />;
}

function NavAnchor({
  current,
  className,
  activeClassName,
  inactiveClassName,
  ...props
}: AnchorProps & { current: boolean }) {
  return (
    <Link
      {...props}
      aria-current={current ? "page" : undefined}
      className={cx(className, current ? activeClassName : inactiveClassName)}
    />
  );
}

/** Whether a link to `href` marks the page at `here` (both short paths). */
export function isCurrent(here: string, href: string, exact = false): boolean {
  const path = href.split(/[?#]/)[0] || "/";
  if (here === path) return true;
  return !exact && path !== "/" && here.startsWith(`${path}/`);
}
