import { cx } from "@/components/ui";

/** The star mark: the decorative red (#E63946) as a fill, which is what it is for (plan D17);
 *  it carries no words, and the name beside it is the accessible text. */
export function StarMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cx("size-7 shrink-0 text-red", className)}
      fill="currentColor"
    >
      <path d="M12 2.6l2.83 5.74 6.33.92-4.58 4.46 1.08 6.3L12 17.05l-5.66 2.97 1.08-6.3-4.58-4.46 6.33-.92z" />
    </svg>
  );
}

/**
 * The lockup: the star, "Crew Stars" in Nunito 900 with the prototype's red dot, and a small
 * muted line under it naming the surface ("Owner portal").
 */
export function Lockup({ name, subtitle }: { name: string; subtitle?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <StarMark />
      <span className="flex min-w-0 flex-col">
        <span className="flex items-center gap-1.25 truncate text-lg font-black leading-tight tracking-tight">
          {name}
          <i aria-hidden="true" className="mt-2 inline-block size-1.5 rounded-full bg-red" />
        </span>
        {subtitle ? (
          <span className="truncate text-2xs font-bold leading-tight text-muted">{subtitle}</span>
        ) : null}
      </span>
    </span>
  );
}
