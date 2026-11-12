/**
 * How a control shows it has focus. One indicator, never two.
 *
 * Text entry (inputs, selects, textareas, search boxes, code cells) draws no ring: its own 1px
 * edge turns brand-ink and a 1px inset ring of the same colour sits inside it, so the edge
 * reads as 2px without the box growing. A field that showed the global ring as well would
 * have a highlighted border and a second outline 2px outside it - the double focus this file
 * exists to prevent.
 *
 * Everything else (buttons, links, chips, tabs, switches) keeps the single ring from
 * globals.css and never changes its border on focus.
 *
 * `outline-hidden` rather than `outline-none`: in Windows High Contrast the inset ring is
 * dropped with every other shadow, and `outline-hidden` leaves an outline the system can draw.
 */

/** On the control itself. `focus:` rather than `focus-visible:`: a field that has focus is
 *  being typed into, however it was reached, so it always shows it. */
export const fieldFocus =
  "outline-hidden focus:border-brand-ink focus:inset-ring-1 focus:inset-ring-brand-ink";

/** On a wrapper that draws the edge for an input inside it (a search box with its icon). The
 *  input inside takes `outline-none bg-transparent`. */
export const fieldFocusWithin =
  "focus-within:border-brand-ink focus-within:inset-ring-1 focus-within:inset-ring-brand-ink " +
  "forced-colors:focus-within:outline-2 forced-colors:focus-within:outline-offset-2";

/** Wrong and focused stays wrong: the edge is danger either way, so focus never hides it. */
export const fieldInvalid =
  "aria-invalid:border-danger aria-invalid:focus:border-danger aria-invalid:focus:inset-ring-danger";

export const fieldInvalidWithin =
  "has-[[aria-invalid=true]]:border-danger has-[[aria-invalid=true]]:focus-within:border-danger " +
  "has-[[aria-invalid=true]]:focus-within:inset-ring-danger";

/** Inside a box that scrolls sideways (a table region), a ring drawn outside a link is
 *  clipped by the box. This draws the same single ring inside the element instead. */
export const ringInside = "focus-visible:outline-offset-[-3px]";

/**
 * Puts focus back on what opened a dialog once it has closed (NF-11). Browsers do this for a
 * modal <dialog> themselves; this covers one that does not, which leaves focus on the page's
 * body and a keyboard user back at the top. It does nothing when focus has already gone
 * somewhere on purpose, or when the opener left with what it opened (a deleted row).
 */
export function restoreFocus(opener: HTMLElement | null, dialog: HTMLElement | null): void {
  const now = document.activeElement;
  const lost = now === null || now === document.body || (dialog !== null && dialog.contains(now));
  if (lost && opener?.isConnected) opener.focus();
}
