import { cx, inlineInputClass } from "@/components/ui";

/**
 * The owner-portal pieces the prototype repeats on every page: the page header, the white
 * card (`.o-card`), the settings row (`.o-frow`), and the plain table (`.o-table`). Kept here
 * rather than in the shared ui set because they are this portal's layout, not general
 * primitives. None of them holds state, so a server page can render them.
 */

/** Page header: a 26px Nunito 900 title, one muted line under it, actions bottom-aligned. */
export function ConsoleHeader({
  title,
  lead,
  actions,
  className,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mb-6 flex flex-wrap items-end gap-4", className)}>
      <div className="min-w-0 flex-1">
        <h1 className="m-0 text-3xl font-black tracking-tight">{title}</h1>
        {lead ? <p className="mt-1.5 text-sm text-muted">{lead}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2.5">{actions}</div> : null}
    </div>
  );
}

/** A white card: 1px line border, radius 20, 20px in. */
export function ConsoleCard({
  className,
  children,
  as: Tag = "div",
  ...rest
}: {
  className?: string;
  children: React.ReactNode;
  as?: "div" | "section" | "article";
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      {...rest}
      className={cx("flex min-w-0 flex-col gap-3.5 rounded-2xl border border-border bg-surface-raised p-5", className)}
    >
      {children}
    </Tag>
  );
}

/** Card title as the prototype draws it: 17px at weight 900. */
export function CardTitle({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h2 id={id} className={cx("m-0 flex items-center gap-2 text-title font-black tracking-normal", className)}>
      {children}
    </h2>
  );
}

/** A settings group: icon tile, title and one line of what it governs, then its rows. */
export function SectionCard({
  id,
  icon,
  title,
  lead,
  action,
  children,
  className,
}: {
  id: string;
  icon: React.ReactNode;
  title: string;
  lead?: string;
  /** A button for the whole group (Add ...), at the right of the title. */
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <ConsoleCard as="section" aria-labelledby={id} className={className}>
      <div className="mb-[18px] flex flex-wrap items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-[38px] shrink-0 items-center justify-center rounded-compact bg-brand-subtle text-brand-ink"
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <CardTitle id={id}>{title}</CardTitle>
          {lead ? <p className="mt-0.5 text-caption text-muted">{lead}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex flex-col gap-[18px]">{children}</div>
    </ConsoleCard>
  );
}

/** Icon tile used on cards that link somewhere (admin home). */
export function IconTile({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cx(
        "flex size-[38px] shrink-0 items-center justify-center rounded-compact bg-brand-subtle text-brand-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** The prototype's number input on a settings row (`.o-in`): 90 wide, bold tabular value. */
export const settingInputClass = cx(inlineInputClass, "w-22.5 shrink-0 font-extrabold tabular-nums");

/** A label and its hint on the left, the control on the right; stacked on a phone. */
export function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  /** Ties the visible label to the control when the control is an input. */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid items-center gap-4 border-b border-border py-3.5 last:border-b-0 rail:grid-cols-[minmax(0,1fr)_auto]">
      <span className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block font-extrabold">
            {label}
          </label>
        ) : (
          <span className="block font-extrabold">{label}</span>
        )}
        {hint ? <span className="mt-0.5 block max-w-[60ch] text-caption text-muted">{hint}</span> : null}
      </span>
      {children}
    </div>
  );
}

export interface ConsoleColumn<Row> {
  key: string;
  header: React.ReactNode;
  align?: "start" | "end";
  /** Drops the column on narrow screens. */
  hideBelow?: "sm" | "md" | "lg";
  /** Fixed width for narrow status columns. */
  className?: string;
  cell: (row: Row) => React.ReactNode;
}

const hide = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

/**
 * The prototype's table: 11px uppercase muted headers, 13.5px cells, a line under every row,
 * no zebra. Scrolls sideways inside its own named, focusable box on narrow screens so the
 * page never does (NF-01).
 */
export function ConsoleTable<Row>({
  caption,
  columns,
  rows,
  rowKey,
  rowClassName,
  className,
}: {
  caption: string;
  columns: ReadonlyArray<ConsoleColumn<Row>>;
  rows: readonly Row[];
  rowKey: (row: Row) => string;
  rowClassName?: (row: Row) => string | undefined;
  className?: string;
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className={cx("relative overflow-x-auto", className)}
    >
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  "whitespace-nowrap border-b border-border px-2.5 py-2 text-2xs font-black uppercase tracking-wide text-muted",
                  column.align === "end" && "text-right",
                  column.hideBelow && hide[column.hideBelow],
                  column.className,
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              className={cx("group/row transition-colors duration-fast hover:bg-background", rowClassName?.(row))}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cx(
                    "border-b border-border px-2.5 py-2.75 align-middle text-sm group-last/row:border-b-0",
                    column.align === "end" && "text-right",
                    column.hideBelow && hide[column.hideBelow],
                    column.className,
                  )}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
