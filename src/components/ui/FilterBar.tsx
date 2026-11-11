import { cx } from "./cx";
import type { Query } from "./query";

/** Search and filters as a GET form: submitting puts the state in the URL, the server renders
 *  the result, and the browser's back button works. `hidden` carries the rest of the query
 *  through so filtering does not silently reset the sort. */
export function FilterBar({
  action,
  query,
  carry = [],
  children,
  submitLabel,
  label,
  className,
}: {
  action: string;
  query: Query;
  /** Query keys to preserve across a submit. `offset` is deliberately not one of them. */
  carry?: readonly string[];
  children: React.ReactNode;
  submitLabel: string;
  label: string;
  className?: string;
}) {
  return (
    <form
      action={action}
      method="get"
      aria-label={label}
      className={cx("flex flex-wrap items-end gap-3", className)}
    >
      {carry.map((key) => {
        const value = query[key];
        return typeof value === "string" && value !== "" ? (
          <input key={key} type="hidden" name={key} value={value} />
        ) : null;
      })}
      {children}
      <button
        type="submit"
        // A secondary button, as Button draws one at console size.
        className="h-11 rounded-compact border border-button-border bg-surface-raised px-4 text-sm font-extrabold hover:bg-background"
      >
        {submitLabel}
      </button>
    </form>
  );
}
