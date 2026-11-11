import { cx } from "./cx";

export type BadgeTone = "neutral" | "brand" | "success" | "warning" | "danger" | "reward";

const tones: Record<BadgeTone, string> = {
  neutral: "bg-surface text-muted",
  brand: "bg-brand-subtle text-brand-strong",
  success: "bg-success-subtle text-success-ink",
  warning: "bg-warning-subtle text-warning-ink",
  danger: "bg-danger-subtle text-danger-ink",
  reward: "bg-reward-subtle text-reward-ink",
};

/** A state, spelled out, in the prototype's chip shape. `children` is required and is never an icon
 *  alone: the tone repeats what the words already say (NF-11). For statuses with a fixed icon,
 *  prefer StatusPill. */
export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex min-h-6 max-w-full items-center gap-1.25 whitespace-nowrap rounded-full px-2.5 text-xs font-bold",
        tones[tone],
        className,
      )}
    >
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
