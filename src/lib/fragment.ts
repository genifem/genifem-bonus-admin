"use client";

import { useEffect, useSyncExternalStore } from "react";

/** What each name held when the page first saw it, since the fragment is wiped right after
 *  (keyed like the tab's storage, by page and name). */
const seen = new Map<string, string>();

const noSubscription = () => () => {};

/** Where the value is kept for this tab: per name and page, so an invite's token never
 *  stands in for a reset's. */
const storageKey = (name: string) => `cs_link:${window.location.pathname}:${name}`;

function stored(name: string): string | null {
  try {
    return window.sessionStorage.getItem(storageKey(name));
  } catch {
    // Storage can be switched off; the value then lasts until the page reloads.
    return null;
  }
}

function keep(name: string, value: string) {
  try {
    window.sessionStorage.setItem(storageKey(name), value);
  } catch {
    // As above: kept in memory only.
  }
}

function read(name: string): string | null {
  const key = storageKey(name);
  const value = new URLSearchParams(window.location.hash.slice(1)).get(name);
  if (value) {
    seen.set(key, value);
    keep(name, value);
  }
  const known = seen.get(key) ?? stored(name);
  if (known) seen.set(key, known);
  return known ?? null;
}

/**
 * A secret an emailed link carries in its fragment - an invite's or a reset's `#token=…` (P7) -
 * read once and then wiped from the address bar (`history.replaceState`), so it is not left in
 * the history, a bookmark or a screenshot. The fragment never reaches a server or its logs;
 * that is why the API puts it there.
 *
 * It is kept for the browser tab (sessionStorage, which goes with the tab), so a reload - a
 * phone browser bringing a tab back - still has it once the address bar no longer does. Call
 * forgetFragmentParam once it has been used.
 *
 * `undefined` while the page is drawn on the server (which cannot see a fragment) and during
 * hydration; then the value, or null when the link had none. Reading the address bar through
 * useSyncExternalStore keeps the first client render equal to the server's, with no state set
 * from an effect. A null `name` reads nothing and leaves the address bar alone.
 */
export function useFragmentParam(name: string | null): string | null | undefined {
  const value = useSyncExternalStore(
    noSubscription,
    () => (name === null ? null : read(name)),
    () => undefined,
  );
  // After every render, not once: Next's router keeps the address it first loaded, fragment
  // and all, and a refresh (switching language) writes it back to the address bar.
  useEffect(() => {
    if (name === null) return;
    read(name); // keep it before the fragment goes
    if (new URLSearchParams(window.location.hash.slice(1)).has(name)) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  });
  return value;
}

/** Drops a value useFragmentParam kept, once the link has done its work (or been refused for
 *  good), so a later visit to the page does not offer it again. */
export function forgetFragmentParam(name: string): void {
  seen.delete(storageKey(name));
  try {
    window.sessionStorage.removeItem(storageKey(name));
  } catch {
    // Nothing kept.
  }
}
