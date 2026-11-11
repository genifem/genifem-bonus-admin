import { motion } from "@crewstars/shared";

/**
 * Enter and exit for a native <dialog> opened with showModal(), in CSS alone.
 *
 * Closed, the dialog is transparent; `open` fades it in and `starting:` gives the first frame
 * to animate from. `transition-discrete` keeps `display` and the top-layer `overlay` alive
 * until the fade out finishes, so closing animates too. A caller adds the direction it travels
 * (`translate-x-8 open:translate-x-0 starting:open:translate-x-8` for a side panel).
 *
 * `prefers-reduced-motion` flattens every duration in globals.css, so none of this runs there.
 */
export const dialogMotion = [
  "opacity-0 transition-[opacity,translate,overlay,display] transition-discrete duration-base ease-exit",
  "open:opacity-100 open:ease-enter starting:open:opacity-0",
  "not-open:pointer-events-none",
  "backdrop:bg-sidebar-bg/0 backdrop:transition-[background-color,overlay,display] backdrop:transition-discrete backdrop:duration-base",
  "open:backdrop:bg-sidebar-bg/55 starting:open:backdrop:bg-sidebar-bg/0",
].join(" ");

/** Runs `then` once a dialog's exit transition has had time to finish, or at once when the
 *  person asked for reduced motion. For a dialog its parent unmounts on close. */
export function afterExit(then: () => void): void {
  const reduce =
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) then();
  else window.setTimeout(then, motion.duration.base);
}
