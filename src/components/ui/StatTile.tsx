import Link from "next/link";

import { cx } from "./cx";

export type StatTone = "neutral" | "brand" | "success" | "warning" | "danger" | "reward";

/** The icon chip carries the tone; the label and value carry the meaning on their own, so a
 *  tile still reads to someone who cannot tell the tones apart (NF-11). */
const chip: Record<StatTone, string> = {
  neutral: "bg-surface text-muted",
  brand: "bg-brand-subtle text-brand-strong",
  success: "bg-success-subtle text-success-ink",
  warning: "bg-warning-subtle text-warning-ink",
  danger: "bg-danger-subtle text-danger-ink",
  reward: "bg-reward-subtle text-reward-ink",
};

/**
 * A single number worth looking at: the prototype's KPI tile (`.kpi`) - a 12px label, a 28px
 * 900-weight number, one muted line under it. With `href` it renders as a link (the
 * "Waiting for approval" tile goes to Redemptions) that can mark itself current.
 */
export function StatTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  href,
  active = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: StatTone;
  href?: string;
  /** Marks the filter this tile applies as the one currently in force. */
  active?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-2">
        {icon ? (
          <span
            aria-hidden="true"
            className={cx("flex size-8 items-center justify-center rounded-md", chip[tone])}
          >
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 text-xs font-extrabold text-muted">{label}</span>
      </span>
      <span className="mt-1 break-words font-display text-4xl font-black tracking-tight tabular-nums">
        {value}
      </span>
      {hint ? <span className="mt-auto pt-1 text-xs text-muted">{hint}</span> : null}
    </>
  );
  const shape = cx(
    "flex h-full min-w-0 flex-col rounded-xl border bg-surface-raised p-4 text-left transition-[border-color,box-shadow] duration-fast ease-standard",
    active ? "border-brand inset-ring-1 inset-ring-brand shadow-lift" : "border-border",
    className,
  );
  if (!href) return <div className={shape}>{body}</div>;
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cx(shape, !active && "hover:border-brand")}
    >
      {body}
    </Link>
  );
}
