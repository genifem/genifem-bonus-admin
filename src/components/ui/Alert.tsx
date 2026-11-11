import { cx } from "./cx";

export type AlertKind = "error" | "warning" | "success" | "info";

/** Colour is never the message (NF-11) — the caller's words are. The tint only reinforces. */
const kinds: Record<AlertKind, string> = {
  error: "border-danger bg-danger-subtle text-danger-ink",
  warning: "border-warning bg-warning-subtle text-warning-ink",
  success: "border-success bg-success-subtle text-success-ink",
  info: "border-transparent bg-info-subtle text-foreground",
};

export function Alert({
  kind = "error",
  className,
  children,
}: {
  kind?: AlertKind;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      // An error interrupts; anything else waits its turn.
      role={kind === "error" ? "alert" : "status"}
      className={cx("rounded-lg border p-3", kinds[kind], className)}
    >
      {children}
    </p>
  );
}
