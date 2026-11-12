"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useSyncExternalStore } from "react";

import { NavLink, type NavLinkProps } from "@/components/ui/NavLink";
import { hrefWithStore, isScopedPath, STORE_PARAM } from "@/lib/store-scope";

/**
 * A rail link to a page the store filter belongs to (OP-01: Overview, Stores & people,
 * Redemptions, Monthly awards). It carries the store along, so picking store 2741 on the
 * Overview and then opening Stores & people shows store 2741 there too.
 *
 * On one of those pages the store is the URL's. On any other page (Rewards, Roster...) it is
 * the last one seen on them, remembered for the browser tab, so a detour does not drop it.
 */

const MEMORY_KEY = "cs_store_scope";
/** undefined until first read, so the tab's storage is only touched in the browser. */
let remembered: string | null | undefined;
const listeners = new Set<() => void>();

function recall(): string | null {
  if (remembered === undefined) {
    try {
      remembered = window.sessionStorage.getItem(MEMORY_KEY) || null;
    } catch {
      // Storage can be switched off; the filter then lasts until the page reloads.
      remembered = null;
    }
  }
  return remembered;
}

function remember(store: string | null) {
  if (recall() === store) return;
  remembered = store;
  try {
    if (store) window.sessionStorage.setItem(MEMORY_KEY, store);
    else window.sessionStorage.removeItem(MEMORY_KEY);
  } catch {
    // As above: kept in memory only.
  }
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The store the scoped links carry: null for all stores. */
function useStoreScope(): string | null {
  const path = usePathname();
  const query = useSearchParams();
  // undefined: this page is not one of the filter's, so the memory decides.
  const here = isScopedPath(path) ? query.get(STORE_PARAM)?.trim() || null : undefined;
  // The server cannot know the tab's memory: it draws the links without it, and the browser
  // fills it in once hydrated.
  const stored = useSyncExternalStore(subscribe, recall, () => null);
  useEffect(() => {
    if (here !== undefined) remember(here);
  }, [here]);
  return here !== undefined ? here : stored;
}

function WithScope({ href, ...props }: NavLinkProps) {
  const store = useStoreScope();
  return <NavLink {...props} href={hrefWithStore(href, store)} />;
}

export function ScopedNavLink(props: NavLinkProps) {
  // Reading the query needs a Suspense boundary above it; until it resolves the link is drawn
  // without a store.
  return (
    <Suspense fallback={<NavLink {...props} />}>
      <WithScope {...props} />
    </Suspense>
  );
}
