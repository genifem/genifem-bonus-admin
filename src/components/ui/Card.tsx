import { cx } from "./cx";

/** Portal cards: white, 1px line border, radius 20. `flat` is the tinted panel used for
 *  secondary information; `tile` is the smaller radius-18 stat box. */
export function Card({
  tone = "raised",
  padding = "md",
  className,
  children,
}: {
  tone?: "raised" | "flat" | "tile";
  padding?: "none" | "sm" | "md" | "lg" | "xl";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "w-full min-w-0",
        tone === "flat"
          ? "rounded-2xl bg-surface"
          : tone === "tile"
            ? "rounded-xl border border-border bg-surface-raised"
            : "rounded-2xl border border-border bg-surface-raised",
        { none: "", sm: "p-3.5", md: "p-4.5", lg: "p-5.5", xl: "p-6" }[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
