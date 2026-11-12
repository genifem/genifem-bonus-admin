import { cx } from "@/components/ui/cx";

/**
 * The reward icons owners pick from (OP-11): the prototype's eight, drawn with its own paths
 * so the portal shows the same picture the app does, each on its tint. Each tint and ink is a
 * Crew Stars pair that holds 4.5:1 (packages/shared tokens.test.ts). Not a client component:
 * it holds no state.
 *
 * The API stores the icon as its id. An id this set does not know (typed in another way) is
 * drawn as the gift, the API's default.
 */

export const REWARD_ICONS = ["burger", "cup", "calendar", "gift", "shirt", "sun", "fries", "star"] as const;
export type RewardIconId = (typeof REWARD_ICONS)[number];

const PATHS: Record<RewardIconId, string> = {
  burger: "M4 11c0-3.5 3.6-6 8-6s8 2.5 8 6zM3 14h18M5 17h14v1a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z",
  cup: "M6 8h12l-1.5 13h-9zM5 8h14M12 8l2-5h3",
  calendar: "M4 5h16v16H4zM8 3v4M16 3v4M4 10h16",
  gift: "M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9c-1.5-3-6-3.5-6-1s6 1 6 1zm0 0c1.5-3 6-3.5 6-1s-6 1-6 1z",
  shirt: "M8 3l-5 3 2 5 2-1v11h10V10l2 1 2-5-5-3a4 4 0 0 1-8 0z",
  sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  fries: "M6 10h12l-1.5 11h-9zM8 10L7 3M11 10V3M14 10l1-6M17 10l1.5-5",
  star: "M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z",
};

/** The prototype's REWARD_ICONS tints, as token pairs. */
const TONES: Record<RewardIconId, string> = {
  burger: "bg-peach text-peach-ink",
  cup: "bg-sky text-sky-ink",
  calendar: "bg-mint text-mint-ink",
  gift: "bg-lilac text-lilac-ink",
  shirt: "bg-sky text-sky-ink",
  sun: "bg-butter text-gold-ink",
  fries: "bg-red-soft text-red-action",
  star: "bg-butter text-gold-ink",
};

export function isRewardIcon(icon: string): icon is RewardIconId {
  return (REWARD_ICONS as readonly string[]).includes(icon);
}

/** The bare glyph, decorative: whatever shows it says its name in words. */
export function RewardGlyph({ icon, className }: { icon: string; className?: string }) {
  const known = isRewardIcon(icon) ? icon : "gift";
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cx("shrink-0", className)}
    >
      <path d={PATHS[known]} />
    </svg>
  );
}

/** The glyph on its tint, as the reward's thumbnail (a rounded square). */
export function RewardIcon({ icon, size = "md", className }: { icon: string; size?: "sm" | "md"; className?: string }) {
  const known = isRewardIcon(icon) ? icon : "gift";
  return (
    <span
      aria-hidden="true"
      className={cx(
        "inline-flex shrink-0 items-center justify-center",
        size === "sm" ? "size-8 rounded-lg" : "size-10 rounded-xl",
        TONES[known],
        className,
      )}
    >
      <RewardGlyph icon={known} className={size === "sm" ? "size-4.5" : "size-5"} />
    </span>
  );
}

/** The tint of an icon, for the picker's chosen state. */
export function rewardIconTone(icon: string): string {
  return TONES[isRewardIcon(icon) ? icon : "gift"];
}
