import { CircleAlert } from "lucide-react";

import { cx } from "./cx";

/** What a page shows when it could not load: what happened, in words, and one way on. It is
 *  the page's heading, since it replaces the page, and an alert, so it is read out at once.
 *  Sized like the content it stands in for, so the shell around it does not move. */
export function ErrorState({
  title,
  lead,
  action,
  className,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cx(
        "flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface-raised px-6 py-12 text-center",
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-full bg-danger-subtle text-danger-ink">
        <CircleAlert className="size-6" strokeWidth={2} />
      </span>
      <h1 className="max-w-prose break-words font-sans text-lg font-extrabold tracking-normal">{title}</h1>
      {lead ? <p className="max-w-prose text-sm text-muted">{lead}</p> : null}
      {action ? <div className="mt-1 flex flex-wrap justify-center gap-2.5">{action}</div> : null}
    </div>
  );
}
