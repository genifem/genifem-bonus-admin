import { cx } from "./cx";
import { Spinner } from "./Spinner";

/** Not a client component on purpose: it holds no state, so a server page can render one and
 *  a client form can import the same file without either paying for the other. */

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "dangerSolid"
  | "ink"
  | "onBrand";
/** Heights: lg 54 and md 52 (sign-in), form 48 (dialog footers), console 44,
 *  sm 40, xs 36 (in-card and in-row actions). */
export type ButtonSize = "xs" | "sm" | "console" | "form" | "md" | "lg";

/** Shared with links styled as buttons (`buttonClass`), so an <a> and a <button> match.
 *  Every variant has a 1px border (transparent unless it shows), so no state and no variant
 *  change the box: a disabled secondary button no longer loses its border and shrinks. */
// The border colour lives in each variant, never in the shared base: without a class merger,
// two border colours on one element are settled by stylesheet order, not by intent.
const variants: Record<ButtonVariant, string> = {
  primary: "border-transparent bg-brand text-brand-fg hover:brightness-90",
  secondary: "border-button-border bg-surface-raised text-foreground hover:bg-background",
  // Red words are always the action red (plan D17), never the decorative one.
  ghost: "border-transparent bg-transparent text-brand-ink hover:bg-brand-subtle",
  danger: "border-transparent bg-danger-subtle text-danger-ink hover:brightness-95",
  /** What cannot be taken back, once confirmed (suspend, end a session). */
  dangerSolid: "border-transparent bg-danger text-danger-fg hover:brightness-95",
  /** Ink pill: the prototype's strongest neutral action. */
  ink: "border-transparent bg-foreground text-surface-raised hover:brightness-125",
  onBrand: "border-transparent bg-surface-raised text-brand-strong hover:bg-brand-subtle",
};

/** Minimum heights, so a translation or a larger text setting grows the button rather than
 *  clipping it. Anything under 44px still sits in a 44px row on touch layouts (NF-11).
 *  A label longer than the space it has (Spanish on a 360px phone, NF-02) wraps onto a second
 *  line inside the button instead of running out of it; in a table's actions column the cell's
 *  no-wrap keeps it on one line, and the table scrolls instead. */
const sizes: Record<ButtonSize, string> = {
  xs: "min-h-9 px-3 text-caption",
  sm: "min-h-10 px-3.5 text-caption",
  console: "min-h-11 px-4 text-sm",
  form: "min-h-12 px-5 text-body",
  md: "min-h-13 px-5 text-body",
  lg: "min-h-13.5 px-5 text-body",
};

export function buttonClass({
  variant = "primary",
  size = "md",
  fullWidth = false,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
} = {}) {
  return cx(
    "relative inline-flex max-w-full shrink-0 select-none items-center justify-center gap-2 rounded-compact border py-1.5 text-center text-balance font-extrabold",
    "transition-[background-color,border-color,color,filter,translate] duration-fast ease-standard",
    "active:not-disabled:not-aria-disabled:translate-y-px",
    // A button that is busy keeps its colours (it is working, not off); only a disabled one
    // that is not busy goes grey.
    "disabled:cursor-not-allowed disabled:not-aria-busy:border-transparent disabled:not-aria-busy:bg-disabled disabled:not-aria-busy:text-disabled-fg aria-busy:cursor-progress",
    "aria-disabled:pointer-events-none aria-disabled:border-transparent aria-disabled:bg-disabled aria-disabled:text-disabled-fg",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  /** Shows a spinner and blocks further presses. The box does not change: the spinner sits
   *  over the label (which is still read out) or, on a full-width button, beside it. */
  loading?: boolean;
  /** Decorative; the button still needs its own words. */
  icon?: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  icon,
  disabled,
  children,
  className,
  ...props
}: ButtonProps) {
  // A full-width button has room to spare, so the spinner can take the icon's place beside
  // the words; anywhere else it covers them, so the width stays exactly what it was.
  const overlay = loading && !fullWidth;
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, fullWidth, className })}
    >
      {overlay ? (
        <>
          <span className="inline-flex items-center gap-2 opacity-0">
            {icon}
            {children}
          </span>
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner />
          </span>
        </>
      ) : (
        <>
          {loading ? <Spinner /> : icon}
          {children}
        </>
      )}
    </button>
  );
}
