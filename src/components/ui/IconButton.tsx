import Link from "next/link";

import { cx } from "./cx";

const sizes = { 48: "size-12", 44: "size-11", 40: "size-10", 36: "size-9" } as const;

const variants = {
  /** Bordered square: the default beside a title or in a card corner. */
  outline: "border border-button-border bg-surface-raised text-foreground hover:bg-background",
  /** No box until hovered: inside a toolbar or a row that already draws its own. */
  ghost: "border border-transparent bg-transparent text-muted hover:bg-surface hover:text-foreground",
} as const;

/** A square icon button (radius 14). `label` is required and becomes the accessible name,
 *  because the icon alone says nothing to a screen reader; it is also the tooltip. With `href`
 *  (always a page in this app: a way back) it is a client-side link.
 *
 *  36 and 40 are drawn sizes: on a touch screen the target reaches 44px past the edge. */
export function IconButton({
  label,
  size = 44,
  variant = "outline",
  href,
  className,
  children,
  ...props
}: {
  label: string;
  size?: keyof typeof sizes;
  variant?: keyof typeof variants;
  href?: string;
  className?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  const shape = cx(
    "relative inline-flex shrink-0 items-center justify-center rounded-lg",
    "transition-[background-color,border-color,color] duration-fast ease-standard",
    "disabled:cursor-not-allowed disabled:opacity-50",
    size < 44 && "pointer-coarse:before:absolute pointer-coarse:before:-inset-1 pointer-coarse:before:content-['']",
    variants[variant],
    sizes[size],
    className,
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} title={label} className={shape}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} title={label} className={shape} {...props}>
      {children}
    </button>
  );
}
