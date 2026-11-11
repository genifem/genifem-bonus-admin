import { Check, Clock, X } from "lucide-react";

import { cx } from "./cx";

/** The states a reward request moves through (plan §7), plus a plain informational pill. */
export type PillStatus = "pending" | "approved" | "declined" | "collected" | "info";

/** The prototype's status chips: amber while waiting, mint once approved, a quiet neutral
 *  when declined. */
const styles: Record<PillStatus, string> = {
  pending: "bg-warning-subtle text-warning-ink",
  approved: "bg-success-subtle text-success-ink",
  declined: "bg-surface text-muted",
  collected: "bg-success-subtle text-success-ink",
  info: "bg-info-subtle text-info-ink",
};

const icons: Partial<Record<PillStatus, typeof Check>> = {
  pending: Clock,
  approved: Check,
  declined: X,
  collected: Check,
};

/** A state as a 24px pill: always an icon and a word, never colour alone (NF-11). */
export function StatusPill({
  status,
  children,
  icon,
  className,
}: {
  status: PillStatus;
  children: React.ReactNode;
  /** Overrides the status icon; pass `null` for none. */
  icon?: React.ReactNode | null;
  className?: string;
}) {
  const Glyph = icons[status];
  const glyph =
    icon === undefined ? (
      Glyph ? (
        <Glyph aria-hidden="true" className="size-3.25 shrink-0" strokeWidth={2.4} />
      ) : null
    ) : (
      icon
    );
  return (
    <span
      className={cx(
        "inline-flex min-h-6 max-w-full items-center gap-1.25 whitespace-nowrap rounded-full px-2.5 text-xs font-extrabold",
        styles[status],
        className,
      )}
    >
      {glyph}
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );
}
