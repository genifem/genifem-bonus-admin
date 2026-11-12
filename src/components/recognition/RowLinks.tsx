"use client";

import { cx } from "@/components/ui/cx";

/**
 * Makes each row of the table inside clickable as a whole (OP-03: "clicking a row filters to
 * that store"), by following the row's own link - the one marked `data-row-link`. That link
 * is what a keyboard or a screen reader uses; the rest of the row is a bigger target for a
 * mouse or a finger. A click on anything else interactive in the row, or one that ends a text
 * selection, is left alone.
 */
export function RowLinks({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    // The row's link is the keyboard's way in; this only widens the pointer's.
    <div
      className={cx("[&_tbody_tr:has([data-row-link])]:cursor-pointer", className)}
      onClick={(event) => {
        const target = event.target as HTMLElement;
        if (target.closest("a, button, input, select, textarea, label, [role=button]")) return;
        if (window.getSelection()?.toString()) return;
        target.closest("tr")?.querySelector<HTMLAnchorElement>("a[data-row-link]")?.click();
      }}
    >
      {children}
    </div>
  );
}
