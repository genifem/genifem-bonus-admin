"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState } from "react";

import { nextRail, railCookie, type RailState } from "@/lib/rail";

import { cx } from "./cx";

/**
 * The few parts of the rail that need the browser: the frame that holds the folded or open
 * state, the button that switches it, the tooltips of a folded rail, and the phone strip
 * scrolling to the page you are on. Everything they wrap - the lockup, the links, the account
 * card - is still drawn on the server (Sidebar.tsx).
 */

/** Below this the rail is folded; the same 10rem as the `folded` variant in globals.css. */
const FOLDED_BELOW_PX = 160;

const RailContext = createContext<{ toggle: () => void } | null>(null);

/**
 * The portal's frame. `data-rail` is what globals.css turns into the rail's width; it starts
 * as the server read it from the cookie, so the first paint is right, and the toggle changes
 * it here and in the cookie, which the next page load reads.
 */
export function RailFrame({
  initial,
  className,
  children,
}: {
  initial: RailState;
  className?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<RailState>(initial);
  const frame = useRef<HTMLDivElement>(null);

  function toggle() {
    // What the screen shows decides, not the state: "auto" is folded or open by the width.
    const width = frame.current ? parseFloat(getComputedStyle(frame.current).getPropertyValue("--rail-w")) : NaN;
    const foldedNow = Number.isNaN(width) ? state === "collapsed" : width * 16 < FOLDED_BELOW_PX;
    const next = nextRail(foldedNow);
    document.cookie = railCookie(next);
    setState(next);
  }

  return (
    <RailContext value={{ toggle }}>
      <div ref={frame} data-rail={state} className={className}>
        {children}
      </div>
    </RailContext>
  );
}

/**
 * Folds the rail to its icons, or opens it again. Its name and icon follow the rail's width in
 * CSS (the `folded` variant), so they are right from the first paint whatever the server
 * guessed: the name is whichever of the two words is displayed.
 */
export function RailToggle({
  collapseLabel,
  expandLabel,
  controls,
  className,
}: {
  collapseLabel: string;
  expandLabel: string;
  /** The rail's id. */
  controls: string;
  className?: string;
}) {
  const rail = useContext(RailContext);
  return (
    <button
      type="button"
      aria-controls={controls}
      data-rail-tip=""
      data-rail-tip-always=""
      onClick={rail?.toggle}
      className={cx(
        "relative size-11 shrink-0 items-center justify-center rounded-compact text-sidebar-muted transition-colors duration-fast",
        "hover:bg-sidebar-hover-bg hover:text-sidebar-fg",
        className,
      )}
    >
      <PanelLeftClose aria-hidden="true" className="size-5 folded:hidden" strokeWidth={2} />
      <PanelLeftOpen aria-hidden="true" className="hidden size-5 folded:block" strokeWidth={2} />
      <span className="sr-only folded:hidden">{collapseLabel}</span>
      <span className="sr-only hidden folded:inline">{expandLabel}</span>
    </button>
  );
}

/**
 * The tooltips of a folded rail: the name of the link (or button) under the pointer or with
 * keyboard focus, beside the rail. One shared bubble, placed in the browser's top layer (the
 * popover API) so the rail's own scrolling cannot clip it. It repeats a name the control
 * already has, so it is hidden from screen readers.
 *
 * WCAG 1.4.13: it stays while the pointer moves onto it, Escape dismisses it, and it goes when
 * the pointer or focus leaves. A control marked `data-rail-tip-always` (the toggle, an icon on
 * its own) has its tooltip in an open rail too; `data-rail-tip="words"` gives the words when
 * the control's own text is not them.
 */
export function RailTips() {
  const tip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const bubble = tip.current;
    if (!bubble) return;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    const target = (node: EventTarget | null) =>
      node instanceof Element ? node.closest<HTMLElement>("[data-rail-tip]") : null;

    function hide() {
      clearTimeout(hideTimer);
      if (bubble?.matches(":popover-open")) bubble.hidePopover();
    }

    function show(control: HTMLElement) {
      if (!bubble) return;
      const rail = control.closest<HTMLElement>("[data-rail-scroll]");
      const railBox = rail?.getBoundingClientRect();
      const folded = railBox ? railBox.width < FOLDED_BELOW_PX : false;
      if (!folded && !control.hasAttribute("data-rail-tip-always")) return;
      // Not over a menu the control has opened.
      if (control.matches("[aria-expanded=true]") || control.querySelector("[aria-expanded=true]")) return;
      const words = control.getAttribute("data-rail-tip") || control.innerText.trim();
      if (!words) return;
      clearTimeout(hideTimer);
      bubble.textContent = words;
      if (!bubble.matches(":popover-open")) bubble.showPopover();
      const box = control.getBoundingClientRect();
      const left = (folded && railBox ? railBox.right : box.right) + 8;
      const top = box.top + box.height / 2 - bubble.offsetHeight / 2;
      const room = document.documentElement.clientHeight - bubble.offsetHeight - 8;
      bubble.style.left = `${left}px`;
      bubble.style.top = `${Math.max(8, Math.min(top, room))}px`;
    }

    const onOver = (event: PointerEvent) => {
      const control = target(event.target);
      if (control) show(control);
    };
    const onOut = (event: PointerEvent) => {
      const control = target(event.target);
      if (!control || control.contains(event.relatedTarget as Node | null)) return;
      if (event.relatedTarget === bubble) return;
      // A moment's grace, so the pointer can cross onto the bubble.
      clearTimeout(hideTimer);
      hideTimer = setTimeout(hide, 120);
    };
    const onFocusIn = (event: FocusEvent) => {
      const control = target(event.target);
      if (control && (event.target as HTMLElement).matches(":focus-visible")) show(control);
      else hide();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") hide();
    };
    const onBubbleEnter = () => clearTimeout(hideTimer);

    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerout", onOut);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", hide);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    bubble.addEventListener("pointerenter", onBubbleEnter);
    bubble.addEventListener("pointerleave", hide);
    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", hide);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", hide, true);
      window.removeEventListener("resize", hide);
      bubble.removeEventListener("pointerenter", onBubbleEnter);
      bubble.removeEventListener("pointerleave", hide);
    };
  }, []);

  return (
    <div
      ref={tip}
      popover="manual"
      aria-hidden="true"
      className="fixed inset-auto top-0 left-0 m-0 max-w-64 rounded-md bg-foreground px-2.5 py-1.5 text-caption font-bold text-surface-raised shadow-popover"
    />
  );
}

/**
 * On a phone the rail is one sideways strip of links. A page further along it (Roster, the
 * audit log) would open with its own link out of view, so the strip is turned to show it,
 * once per page.
 */
export function RailStripFocus({ strip }: { strip: string }) {
  const path = usePathname();
  useEffect(() => {
    if (!window.matchMedia("(width < 53.75rem)").matches) return;
    const box = document.getElementById(strip);
    const link = box?.querySelector<HTMLElement>("[aria-current=page]");
    if (!box || !link) return;
    const outer = box.getBoundingClientRect();
    const inner = link.getBoundingClientRect();
    box.scrollLeft += inner.left - outer.left - (outer.width - inner.width) / 2;
  }, [path, strip]);
  return null;
}
