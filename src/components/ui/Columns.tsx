import { cx } from "./cx";

/**
 * The portal's page layouts, so a wide screen is used the same way on every page: cards stacked
 * on a phone and a narrow page, side by side once the page column has room for both. The
 * column is measured, not the window (`@container/page`, Sidebar.tsx): it grows when the rail
 * folds, and these follow it.
 *
 *   halves    two equal cards from a 896px column (Overview's lists, Recognize)
 *   settings  two cards of settings rows from 1152px, where each still has room for a
 *             setting's words and its control on one line (Coins & limits)
 *   aside     a main card and a 352px companion beside it from 896px, 416px from 1280px
 *             (the wheel's preview)
 *
 * The gap between the cards is the page's own (`gap-section`).
 */
const layouts = {
  halves: "@4xl/page:grid-cols-2",
  settings: "@6xl/page:grid-cols-2",
  aside: "@4xl/page:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] @7xl/page:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]",
} as const;

export type ColumnsLayout = keyof typeof layouts;

export function Columns({
  layout,
  align = "start",
  className,
  children,
}: {
  layout: ColumnsLayout;
  /** `stretch` gives cards side by side the same height; `start` lets each be as tall as it is. */
  align?: "start" | "stretch";
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "grid min-w-0 grid-cols-1 gap-section",
        align === "start" ? "items-start" : "items-stretch",
        layouts[layout],
        className,
      )}
    >
      {children}
    </div>
  );
}
