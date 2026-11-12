import { Progress } from "@/components/ui/Progress";
import { cx } from "@/components/ui/cx";

/**
 * One of the prototype's mini-bars with its figure beside it: crew recognized (mint) or reward
 * budget used. The figure says the number; the bar only shows it at a glance, so neither
 * colour carries meaning on its own (NF-11).
 */
export function Meter({
  label,
  value,
  max,
  text,
  tone = "brand",
  layout = "inline",
  className,
}: {
  /** Names the bar for a screen reader: what it measures and where. */
  label: string;
  value: number;
  max: number;
  /** The figure, as read: "43% (3/7)", "1,200 / 4,000". */
  text: React.ReactNode;
  tone?: "brand" | "success" | "warning" | "danger";
  /** inline: bar and figure on one line (a table cell). stacked: the figure above (a card). */
  layout?: "inline" | "stacked";
  className?: string;
}) {
  const bar = <Progress label={label} value={Math.max(0, Math.min(value, max))} max={max} tone={tone} />;
  if (layout === "stacked") return <div className={cx("flex flex-col gap-1.5", className)}>{bar}</div>;
  return (
    <div className={cx("flex items-center gap-2", className)}>
      <div className="w-22 shrink-0">{bar}</div>
      <span className="whitespace-nowrap text-caption tabular-nums">{text}</span>
    </div>
  );
}
