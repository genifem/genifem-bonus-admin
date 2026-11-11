import { cx } from "./cx";

export type RingTone = "brand" | "warning" | "success" | "danger" | "onBrand" | "onDark";

const tones: Record<RingTone, { track: string; bar: string }> = {
  brand: { track: "var(--brand-subtle)", bar: "var(--brand)" },
  warning: { track: "var(--warning-subtle)", bar: "var(--warning)" },
  success: { track: "var(--success-subtle)", bar: "var(--success)" },
  danger: { track: "var(--danger-subtle)", bar: "var(--danger)" },
  // White on a red card.
  onBrand: { track: "rgba(255,255,255,0.22)", bar: "#FFFFFF" },
  // Gold on an ink card.
  onDark: { track: "rgba(255,255,255,0.15)", bar: "var(--warning)" },
};

/** A progress ring (a tier's progress, a budget used). The centre is
 *  whatever `children` says; pass `label` so the ring has a name for assistive technology. */
export function ProgressRing({
  value,
  size = 88,
  stroke,
  tone = "brand",
  label,
  children,
  className,
}: {
  /** 0 to 1. */
  value: number;
  size?: number;
  stroke?: number;
  tone?: RingTone;
  label?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const width = stroke ?? Math.round(size / 10);
  const r = (size - width) / 2;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, value));
  const { track, bar } = tones[tone];
  const centre = size / 2;
  return (
    <div
      className={cx("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={centre} cy={centre} r={r} fill="none" stroke={track} strokeWidth={width} />
        {clamped > 0 ? (
          <circle
            cx={centre}
            cy={centre}
            r={r}
            fill="none"
            stroke={bar}
            strokeWidth={width}
            strokeLinecap="round"
            strokeDasharray={`${c * clamped} ${c}`}
            transform={`rotate(-90 ${centre} ${centre})`}
          />
        ) : null}
      </svg>
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        aria-hidden={label ? true : undefined}
      >
        {children}
      </div>
    </div>
  );
}
