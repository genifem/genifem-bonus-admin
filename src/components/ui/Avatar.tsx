import { cx } from "./cx";

/** The prototype's avatar tints, each a Crew Stars pair whose ink holds 4.5:1 on its tint
 *  (packages/shared tokens.test.ts, paletteContrast). Fixed so a list of people does not turn
 *  into one colour. */
const fills = [
  "bg-butter text-gold-ink",
  "bg-mint text-mint-ink",
  "bg-sky text-sky-ink",
  "bg-lilac text-lilac-ink",
  "bg-peach text-peach-ink",
  "bg-red-soft text-red-action",
] as const;

/** Same name, same colour, on every screen. */
function fillFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  return fills[Math.abs(hash) % fills.length]!;
}

/**
 * Initials, not a photograph: the roster has names long before it has pictures. Decorative,
 * because the name it stands for is always written next to it.
 *
 * Plain cream by default. `colored` gives the prototype's tinted discs, keyed on `seed` -
 * pass the person's id so two people who share initials still read as different people.
 */
export function Avatar({
  name,
  colored = false,
  seed,
  className,
}: {
  name: string;
  colored?: boolean;
  seed?: string;
  className?: string;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full font-black",
        colored ? fillFor(seed ?? name) : "bg-surface text-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
