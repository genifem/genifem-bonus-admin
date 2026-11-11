import { cx } from "./cx";

const tones = {
  brand: "bg-brand",
  warning: "bg-warning",
  success: "bg-success",
  danger: "bg-danger",
} as const;

/** The continuous bar (video position, store completion). `label` is required: without one a
 *  screen reader announces only "progress bar" (NF-11). */
export function Progress({
  label,
  value,
  max,
  tone = "brand",
  segmented = false,
  className,
}: {
  label: string;
  value: number;
  max: number;
  tone?: keyof typeof tones;
  /** Discrete blocks rather than a continuous fill, for small counts. */
  segmented?: boolean;
  className?: string;
}) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  const segments = segmented && max > 0 && max <= 12 ? Array.from({ length: max }) : null;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cx(
        segments ? "flex w-full gap-1" : "h-2 w-full overflow-hidden rounded-full bg-track",
        className,
      )}
    >
      {segments ? (
        segments.map((_, index) => (
          <span
            key={index}
            className={cx("h-2.5 flex-1 rounded-[3px]", index < value ? tones[tone] : "bg-track")}
          />
        ))
      ) : (
        <div className={cx("h-full rounded-full", tones[tone])} style={{ width: `${pct}%` }} />
      )}
    </div>
  );
}
