import type { Schemas } from "@crewstars/api-client";
import { ArrowUp, Coins, Flag, Heart, Sparkles, Users, Zap, type LucideIcon } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { cx } from "@/components/ui/cx";

import { formatCount } from "./numbers";
import type { TagId } from "./send-intent";

/**
 * The small labels the recognition pages share: a shout-out's value tag, a tier, a coin
 * amount. Not client components: they hold no state, so a server page draws them for nothing
 * and the shout-out form can use the same ones.
 */

/** The six tags in their plan §13 pairs, each ink holding 4.5:1 on its tint
 *  (packages/shared tokens.test.ts). The icon repeats the name; it never stands alone. */
export const TAG_STYLE: Record<TagId, { tone: string; icon: LucideIcon }> = {
  guest: { tone: "bg-red-soft text-red-action", icon: Heart },
  rush: { tone: "bg-butter text-gold-ink", icon: Zap },
  team: { tone: "bg-mint text-mint-ink", icon: Users },
  clean: { tone: "bg-sky text-sky-ink", icon: Sparkles },
  above: { tone: "bg-lilac text-lilac-ink", icon: ArrowUp },
  lead: { tone: "bg-peach text-peach-ink", icon: Flag },
};

export function TagChip({ tag, className }: { tag: TagId; className?: string }) {
  const t = useTranslations("recognition.tags");
  const { tone, icon: Icon } = TAG_STYLE[tag];
  return (
    <span
      className={cx(
        "inline-flex min-h-6 items-center gap-1.25 whitespace-nowrap rounded-full px-2.5 text-xs font-extrabold",
        tone,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.4} />
      {t(tag)}
    </span>
  );
}

/** A tier by its name in the reader's language (an owner-entered name falls back to English,
 *  plan G8), with its colour as a dot: the colour is the operator's and not checked for
 *  contrast, so it never carries the words. */
export function TierChip({ tier }: { tier: Schemas["TierOut"] }) {
  const locale = useLocale();
  const name = locale.startsWith("es") && tier.name_es ? tier.name_es : tier.name;
  return (
    <span className="inline-flex min-h-6 items-center gap-1.5 whitespace-nowrap rounded-full bg-surface px-2.5 text-xs font-extrabold text-foreground">
      <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
      {name}
    </span>
  );
}

/** Coins, as the prototype's butter pill: "+100" on a post, a balance on a person. The figure
 *  is read out with its unit. */
export function CoinPill({ coins, plus = false, className }: { coins: number; plus?: boolean; className?: string }) {
  const t = useTranslations("recognition");
  const locale = useLocale();
  return (
    <span
      className={cx(
        "inline-flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-butter py-0.5 pl-1.5 pr-2.5 text-caption font-black tabular-nums text-gold-ink",
        className,
      )}
    >
      <Coins aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.4} />
      <span aria-hidden="true">{`${plus ? "+" : ""}${formatCount(coins, locale)}`}</span>
      <span className="sr-only">{plus ? t("plusCoins", { count: coins }) : t("coins", { count: coins })}</span>
    </span>
  );
}
