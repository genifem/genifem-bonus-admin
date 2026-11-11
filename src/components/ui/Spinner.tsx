import { cx } from "./cx";

/** Purely decorative: whatever is loading announces itself (aria-busy, or a live region).
 *  A second announcement from here would only talk over it. Reduced motion is handled
 *  globally in globals.css, which flattens the animation rather than removing the mark. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}
