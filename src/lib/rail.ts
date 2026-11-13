/**
 * The rail's folded or open state, remembered in a cookie so the server draws the page the
 * way the owner left it: the first paint is already right, with no jump once the page has
 * loaded (globals.css turns the state into the rail's width).
 *
 *   expanded   240px, icons and words, chosen by the owner
 *   collapsed  72px, icons with a tooltip each, chosen by the owner
 *   auto       no choice made yet: folded below 1280px, open above
 *
 * Not a secret and not read by any script but the toggle's, so it is a plain cookie, like the
 * language one.
 */

export const RAIL_COOKIE = "cs_rail";

export type RailChoice = "expanded" | "collapsed";
export type RailState = RailChoice | "auto";

/** A year, as for the language: it is a preference of this browser, not of the session. */
const MAX_AGE_S = 60 * 60 * 24 * 365;

/** The state a cookie value asks for; anything else (no cookie, an old or edited value) is
 *  "auto". */
export function railState(value: string | null | undefined): RailState {
  return value === "expanded" || value === "collapsed" ? value : "auto";
}

/** What the toggle does from where the rail is now: open it when it is folded, fold it when
 *  it is open. `foldedNow` is what the screen shows, which for "auto" depends on its width. */
export function nextRail(foldedNow: boolean): RailChoice {
  return foldedNow ? "expanded" : "collapsed";
}

/** The `document.cookie` line that remembers a choice for the whole portal. */
export function railCookie(choice: RailChoice): string {
  return `${RAIL_COOKIE}=${choice}; path=/; max-age=${MAX_AGE_S}; samesite=lax`;
}
