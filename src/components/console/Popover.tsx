"use client";

import Link from "next/link";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { cx } from "@/components/ui";

export type PopoverPlacement = "down-end" | "down-start" | "up-end" | "up-start";

/** Space between the trigger and the panel, and the least the panel keeps from the viewport's
 *  edges. */
const GAP = 6;
const EDGE = 8;

interface Box {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

/**
 * Where the panel goes, in viewport coordinates: on the side `placement` asks for when it fits,
 * on the other side when only that one fits, and otherwise on the roomier side with a height cap
 * so it scrolls inside itself. Sideways it lines up with the trigger's end (or start) edge and is
 * then pushed back inside the viewport.
 */
export function placePanel(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  placement: PopoverPlacement,
): { top: number; left: number; maxHeight?: number } {
  const below = viewport.height - anchor.bottom - GAP - EDGE;
  const above = anchor.top - GAP - EDGE;
  const wantsUp = placement.startsWith("up");
  let up: boolean;
  let maxHeight: number | undefined;
  if (size.height <= (wantsUp ? above : below)) up = wantsUp;
  else if (size.height <= (wantsUp ? below : above)) up = !wantsUp;
  else {
    up = above > below;
    maxHeight = Math.max(0, up ? above : below);
  }
  const height = maxHeight ?? size.height;
  const top = up ? anchor.top - GAP - height : anchor.bottom + GAP;

  const wanted = placement.endsWith("end") ? anchor.right - size.width : anchor.left;
  const left = Math.max(EDGE, Math.min(wanted, viewport.width - EDGE - size.width));
  return { top, left, maxHeight };
}

/**
 * A button that shows a small panel of links or controls beside it: the account card's
 * "..." and a crew row's "More actions".
 *
 * A disclosure, not the ARIA menu widget. What it opens is a handful of ordinary links and
 * buttons, which already work with Tab; `role="menu"` would promise arrow-key roving that a
 * screen reader user would then not get. Escape and a click elsewhere close it, and focus
 * goes back to the button that opened it.
 *
 * The panel is pinned to the viewport (`position: fixed`) next to its trigger, so a table's
 * sideways scroll box or a card's rounded clip never cuts it off. It stays right after the
 * trigger in the document, so Tab still goes from the button into the panel and it still
 * inherits the surrounding theme; only its box is taken out of the layout. It opens below (or
 * above, for `up-*`) and flips when the other side is the one with room. Scrolling or resizing
 * closes it rather than leaving it floating over the wrong row.
 */
export function Popover({
  label,
  icon,
  children,
  placement = "down-end",
  triggerClassName,
  panelClassName,
  closeOnSelect = false,
  focusOnOpen,
}: {
  /** The accessible name of an icon-only trigger. Omit it when `icon` holds visible words,
   *  so the name is what a sighted user reads. */
  label?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  placement?: PopoverPlacement;
  triggerClassName?: string;
  panelClassName?: string;
  /** Closes once a button or link inside is pressed, handing focus back to the trigger first,
   *  so a dialog that button opens returns focus there instead of to a hidden panel. */
  closeOnSelect?: boolean;
  /** A selector inside the panel to focus when it opens (a filter box, ready to type in). */
  focusOnOpen?: string;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Measured and placed before the browser paints, so it never flashes in the wrong spot. The
  // panel is first laid out at 0,0: where that lands is the origin of whatever it is fixed to
  // (the viewport, or a transformed ancestor), which is then taken off the target position.
  useLayoutEffect(() => {
    const button = trigger.current;
    const box = panel.current;
    if (!box) return;
    // The panel opens in the browser's top layer (the popover API), above every stacking
    // context on the page: a sticky table cell or the row under it can no longer cover it.
    // It stays right after its trigger in the document, so Tab order and the theme it
    // inherits (the dark rail's tokens) are unchanged.
    if (!open) {
      if (box.matches(":popover-open")) box.hidePopover();
      return;
    }
    if (!box.matches(":popover-open")) box.showPopover();
    if (!button) return;
    Object.assign(box.style, { top: "0px", left: "0px", maxHeight: "", overflowY: "", visibility: "hidden" });
    const origin = box.getBoundingClientRect();
    const spot = placePanel(
      button.getBoundingClientRect(),
      { width: origin.width, height: origin.height },
      { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight },
      placement,
    );
    Object.assign(box.style, {
      top: `${spot.top - origin.top}px`,
      left: `${spot.left - origin.left}px`,
      maxHeight: spot.maxHeight === undefined ? "" : `${spot.maxHeight}px`,
      overflowY: spot.maxHeight === undefined ? "" : "auto",
      visibility: "",
    });
    if (focusOnOpen) box.querySelector<HTMLElement>(focusOnOpen)?.focus({ preventScroll: true });
  }, [open, placement, focusOnOpen]);

  useEffect(() => {
    if (!open) return;
    /** Closes; if focus was inside the panel it goes back to the button rather than to a
     *  hidden element (and from there to the top of the page). */
    function dismiss(refocus = false) {
      const inside = panel.current?.contains(document.activeElement) ?? false;
      setOpen(false);
      if (refocus || inside) trigger.current?.focus();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss(true);
    }
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    function onScroll(event: Event) {
      // A panel tall enough to scroll inside itself stays open while it does.
      if (panel.current?.contains(event.target as Node)) return;
      dismiss();
    }
    const onResize = () => dismiss();
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <div ref={root} className="relative inline-flex">
      <button
        ref={trigger}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((was) => !was)}
        className={triggerClassName}
      >
        {icon}
      </button>
      <div
        ref={panel}
        id={id}
        popover="manual"
        hidden={!open}
        onClick={
          closeOnSelect
            ? (event) => {
                if (!(event.target as Element).closest("button, a")) return;
                trigger.current?.focus();
                setOpen(false);
              }
            : undefined
        }
        className={cx(
          "fixed inset-auto top-0 left-0 m-0 min-w-56 max-w-[calc(100vw-16px)] rounded-xl p-2 shadow-popover",
          // Settles in from just above its trigger; reduced motion makes it instant.
          "transition-[opacity,translate] duration-fast ease-enter starting:-translate-y-1 starting:opacity-0",
          panelClassName ?? "border border-border bg-surface-raised text-foreground",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** One row inside a Popover: a link to another page, styled to match the portal's
 *  rail rows. A client-side link; the page it leaves, popover and all, is replaced. */
export function PopoverLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-2.5 rounded-md px-3 text-left text-sm font-semibold transition-colors duration-fast hover:bg-surface"
    >
      {children}
    </Link>
  );
}
