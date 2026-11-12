import type { LucideIcon } from "lucide-react";

import { cx } from "@/components/ui/cx";

/**
 * A titled card, the prototype's `.o-card`: an h2 with its icon, one muted line, then the
 * content. A section named by its heading, so a screen reader can jump between them.
 */
export function Panel({
  id,
  title,
  icon: Icon,
  lead,
  action,
  flush = false,
  className,
  children,
}: {
  /** The heading's id, unique on the page. */
  id: string;
  title: React.ReactNode;
  icon?: LucideIcon;
  lead?: React.ReactNode;
  /** Beside the heading: a count, a filter. */
  action?: React.ReactNode;
  /** Lets a table run edge to edge under the heading. */
  flush?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className={cx(
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-border bg-surface-raised",
        flush ? "pt-4.5" : "p-4.5",
        className,
      )}
    >
      <div className={cx("flex flex-wrap items-center justify-between gap-x-3 gap-y-2", flush && "px-4.5")}>
        <div className="min-w-0">
          <h2 id={id} className="flex items-center gap-2 text-title font-black tracking-normal">
            {Icon ? <Icon aria-hidden="true" className="size-5 shrink-0 text-brand-ink" strokeWidth={2.2} /> : null}
            <span className="min-w-0 break-words">{title}</span>
          </h2>
          {lead ? <p className="mt-1 text-sm text-muted">{lead}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
