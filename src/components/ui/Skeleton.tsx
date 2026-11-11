import { cx } from "./cx";

/** A placeholder while something loads. Hidden from assistive technology: a screen reader
 *  should hear the real thing when it arrives, not a description of grey boxes. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden="true" className={cx("block animate-pulse rounded-lg bg-border", className)} />;
}
