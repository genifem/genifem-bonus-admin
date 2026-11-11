import { cx } from "./cx";

/** What a new operator sees on their first day, which is most of the console until they load
 *  their content. One explanation and one thing to do — never a bare "no results". */
export function EmptyState({
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
      className={cx(
        "flex flex-col items-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <p className="max-w-prose break-words font-semibold">{title}</p>
      {lead ? <p className="max-w-prose text-sm text-muted">{lead}</p> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2.5">{action}</div> : null}
    </div>
  );
}
