import { cx } from "./cx";
import { fieldFocus, fieldInvalid } from "./focus";

/**
 * The one box every text field in the product draws, as class strings.
 *
 * Kept out of Field.tsx on purpose: that file is a client module, and a Server Component that
 * imports a plain string from a client module receives a client reference, not the string, so
 * its className silently renders as nothing. Server pages (the roster filters, the back-office
 * dialogs) import these from here.
 *
 * The height, padding, text size and radius come from the density the control sits in (a
 * shell sets `data-density`; forms are the default), the edge is `control-border` (3:1 against
 * the page, WCAG 1.4.11), and focus is the single edge from focus.ts.
 */

export type Density = "console" | "form" | "touch";

const controlBase = cx(
  "min-w-0 rounded-(--control-radius) border border-control-border bg-surface-raised text-foreground",
  "px-(--control-px) text-(length:--control-text) placeholder:text-muted",
  "transition-[border-color,box-shadow,background-color] duration-fast ease-standard",
  "disabled:cursor-not-allowed disabled:bg-surface disabled:text-muted",
  fieldFocus,
  fieldInvalid,
);

/** A single-line input or a select, at the height of its density, filling its column. */
export const inputClass = cx("block w-full", controlBase, "h-control");
/** The same control sized by its content or its caller: a filter in a row, a number box. */
export const inlineInputClass = cx(controlBase, "h-control");
/** A multi-line input: starts at three lines and grows by hand. */
export const textareaClass = cx("block w-full", controlBase, "min-h-19 resize-y py-2.5 leading-relaxed");
export const labelClass = "block text-sm font-bold text-foreground";
