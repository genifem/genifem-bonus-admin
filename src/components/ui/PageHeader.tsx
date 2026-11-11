import { cx } from "./cx";

/** Title, one line of explanation, and the page's primary action on the right. Every portal
 *  page opens with this, so an owner always knows where they are and what they can do.
 *
 *  The heading is an h1: each of these pages is its own document, not a section of one. */
export function PageHeader({
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
    // The prototype's `.o-top`: a 26px Nunito 900 title with one muted line under it, and the
    // actions level with the bottom of the text block.
    <div className={cx("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-60 flex-1">
        <h1 className="break-words font-display text-2xl font-black tracking-tight rail:text-3xl">
          {title}
        </h1>
        {lead ? <p className="mt-1 max-w-[62ch] text-sm text-muted">{lead}</p> : null}
      </div>
      {action ? <div className="flex w-full flex-wrap gap-2.5 sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}
