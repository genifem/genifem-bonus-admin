"use client";

import type { Schemas } from "@crewstars/api-client";
import {
  Award,
  CalendarDays,
  Heart,
  Medal,
  Send,
  Sparkles,
  Star,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import {
  ChoiceSetting,
  NumberSetting,
  SwitchSetting,
  TextSetting,
  type ProblemWords,
} from "@/components/coins/SettingControls";
import { patchSettings } from "@/components/coins/useAutosave";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { TAGS, type TagId } from "@/components/recognition/send-intent";
import { localName } from "@/components/rewards/reward-form";
import { cx } from "@/components/ui/cx";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { apiGet } from "@/lib/api";

import { BADGE_RANGES, peopleWith, ruleHasCount, tierProblem, type Badge, type Tier } from "./badge-rules";

type Counts = Schemas["BadgesTiersOut"];
type Count = { id: string; people: number };

/** A badge's icon (the settings' id) as the prototype's BADGE_STYLE draws it, each tint and
 *  ink a Crew Stars pair that holds 4.5:1. An icon this set does not know is drawn as a star. */
const BADGE_ICONS: Record<string, { icon: LucideIcon; tone: string }> = {
  heart: { icon: Heart, tone: "bg-red-soft text-red-action" },
  users: { icon: Users, tone: "bg-mint text-mint-ink" },
  bolt: { icon: Zap, tone: "bg-butter text-gold-ink" },
  sparkle: { icon: Sparkles, tone: "bg-sky text-sky-ink" },
  send: { icon: Send, tone: "bg-lilac text-lilac-ink" },
  calendar: { icon: CalendarDays, tone: "bg-peach text-peach-ink" },
  star: { icon: Star, tone: "bg-butter text-gold-ink" },
};

function BadgeIcon({ icon }: { icon: string }) {
  const { icon: Icon, tone } = BADGE_ICONS[icon] ?? BADGE_ICONS.star!;
  return (
    <span aria-hidden="true" className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", tone)}>
      <Icon className="size-4.5" strokeWidth={2.2} />
    </span>
  );
}

/** "12 people", or a dash when the counts did not load. */
function People({ count }: { count: number | null }) {
  const t = useTranslations("badges");
  const locale = useLocale();
  if (count === null) {
    return (
      <span className="text-muted">
        <span aria-hidden="true">—</span>
        <span className="sr-only">{t("unknown")}</span>
      </span>
    );
  }
  return <b className="font-black tabular-nums">{t("people", { count, shown: formatCount(count, locale) })}</b>;
}

/**
 * The tiers (OP-18): Bronze fixed at 0, each tier after it reached at a number of coins
 * earned all time, above the one before. Each threshold saves itself as it is typed, checked
 * against its neighbours as the owner has them now (the API checks again), and the people at
 * each tier are read again once one lands: tiers are worked out on every read (plan D16), so a
 * change moves people at once.
 */
export function TiersPanel({ tiers, counts }: { tiers: readonly Tier[]; counts: Counts["tiers"] | null }) {
  const t = useTranslations("badges.tiers");
  const locale = useLocale();
  const [mins, setMins] = useState(() => tiers.map((tier) => tier.min));
  const [seen, setSeen] = useState(tiers);
  const [people, setPeople] = useState<readonly Count[] | null>(counts);
  const [seenCounts, setSeenCounts] = useState(counts);
  const [stale, setStale] = useState(false);
  if (seen !== tiers) {
    setSeen(tiers);
    setMins(tiers.map((tier) => tier.min));
  }
  if (seenCounts !== counts) {
    setSeenCounts(counts);
    setPeople(counts);
    setStale(false);
  }

  const name = (tier: Tier) => localName(tier, locale);
  const count = (value: number) => formatCount(value, locale);
  const index = (tier: Tier) => tiers.findIndex((item) => item.id === tier.id);

  // A threshold that landed moves people between tiers: count them again.
  const send = async (changes: Record<string, unknown>) => {
    const out = await patchSettings(changes);
    try {
      const fresh = await apiGet<Counts>("/portal/badges-tiers");
      setPeople(fresh.tiers);
      setStale(false);
    } catch {
      setStale(true);
    }
    return out;
  };

  const columns: Column<Tier>[] = [
    {
      key: "tier",
      header: t("columns.tier"),
      overflow: "nowrap",
      cell: (tier) => (
        <span className="flex items-center gap-2">
          <Medal aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.2} style={{ color: tier.color }} />
          <b className="font-extrabold">{name(tier)}</b>
        </span>
      ),
    },
    {
      key: "min",
      header: t("columns.min"),
      stack: "full",
      cell: (tier) => {
        const at = index(tier);
        if (at === 0) return <span className="text-muted">{t("everyone")}</span>;
        const below = tiers[at - 1];
        const above = tiers[at + 1];
        const words: ProblemWords = {
          problems: {
            low: below ? t("problems.low", { tier: name(below), min: count(mins[at - 1] ?? below.min) }) : "",
            high: above ? t("problems.high", { tier: name(above), min: count(mins[at + 1] ?? above.min) }) : "",
          },
          rule: t("problems.rule"),
        };
        return (
          <NumberSetting
            path={`tiers.${tier.id}.min`}
            value={tier.min}
            range={BADGE_RANGES.tierMin}
            label={t("label", { tier: name(tier) })}
            unit={t("unit")}
            compact
            validate={(value) => tierProblem(mins, at, value)}
            words={words}
            onLive={(value) => setMins((current) => current.map((min, i) => (i === at ? value : min)))}
            send={send}
          />
        );
      },
    },
    {
      key: "people",
      header: t("columns.people"),
      align: "end",
      cell: (tier) => <People count={peopleWith(people, tier.id)} />,
    },
  ];

  return (
    <Panel id="tiers-heading" title={t("heading")} icon={Award} lead={t("lead")} flush>
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={tiers}
        rowKey={(tier) => tier.id}
        bare
        className="border-t border-border"
      />
      <p className="px-4.5 pb-4.5 text-caption text-muted">{stale && people !== null ? t("stale") : t("note")}</p>
    </Panel>
  );
}

/**
 * The badges (OP-18): each one's name (and Spanish name), how it is earned (a count of
 * shout-outs with a tag, of shout-outs given, or of days on the team; the wheel's own badge is
 * only won), its bonus coins, whether it gives a spin, and how many people have it. Each field
 * saves itself as it is typed (plan §9).
 */
export function BadgesPanel({
  badges,
  counts,
  spin,
}: {
  badges: readonly Badge[];
  counts: Counts["badges"] | null;
  /** Spin the wheel's switches, which decide whether "gives a spin" does anything: spins on
   *  at all, then on new badges, and at milestones for a days-on-the-team badge. */
  spin: Pick<Schemas["Spin"], "enabled" | "on_badge" | "on_milestone">;
}) {
  const t = useTranslations("badges.badges");
  const tTags = useTranslations("recognition.tags");
  const locale = useLocale();
  const name = (badge: Badge) => localName(badge, locale);
  const nameWords: ProblemWords = { problems: { required: t("problems.name") }, rule: t("problems.nameRule") };
  const tagOptions = TAGS.map((tag) => ({ value: tag, label: tTags(tag) }));

  const columns: Column<Badge>[] = [
    {
      key: "badge",
      header: t("columns.badge"),
      width: "md",
      cell: (badge) => (
        <div className="flex items-start gap-2.5 spread:min-w-48">
          <BadgeIcon icon={badge.icon} />
          <div className="flex min-w-0 flex-1 flex-col gap-2 stacked:@xl:grid stacked:@xl:grid-cols-2 stacked:@xl:items-end stacked:@xl:gap-x-4">
            <TextSetting
              path={`badges.${badge.id}.name`}
              value={badge.name}
              label={t("name")}
              context={name(badge)}
              words={nameWords}
            />
            <TextSetting
              path={`badges.${badge.id}.name_es`}
              value={badge.name_es}
              label={t("nameEs")}
              context={name(badge)}
              showLabel
              optional
              words={nameWords}
            />
          </div>
        </div>
      ),
    },
    {
      key: "rule",
      header: t("columns.rule"),
      stack: "full",
      cell: (badge) =>
        ruleHasCount(badge.rule) ? (
          <div className="flex flex-col gap-2 spread:min-w-52">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-sm font-bold">{t(`rules.${badge.rule}.verb`)}</span>
              <NumberSetting
                path={`badges.${badge.id}.count`}
                value={badge.count}
                range={BADGE_RANGES.count}
                label={t(`rules.${badge.rule}.label`, { badge: name(badge) })}
                unit={t(`rules.${badge.rule}.unit`)}
                width="sm"
                compact
              />
            </div>
            {badge.rule === "tag" ? (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-caption text-muted">{t("rules.tag.with")}</span>
                <ChoiceSetting<TagId>
                  path={`badges.${badge.id}.tag`}
                  value={badge.tag ?? "guest"}
                  label={t("rules.tag.tagLabel", { badge: name(badge) })}
                  options={tagOptions}
                  width="sm"
                />
              </div>
            ) : null}
          </div>
        ) : (
          <span className="text-caption text-muted">{t("rules.spin.only")}</span>
        ),
    },
    {
      key: "bonus",
      header: t("columns.bonus"),
      stack: "full",
      cell: (badge) => (
        <NumberSetting
          path={`badges.${badge.id}.bonus`}
          value={badge.bonus}
          range={BADGE_RANGES.bonus}
          label={t("bonusLabel", { badge: name(badge) })}
          unit={t("coins")}
          width="sm"
          compact
        />
      ),
    },
    {
      key: "spin",
      header: t("columns.spin"),
      cell: (badge) =>
        badge.rule === "spin" ? (
          <span className="text-muted">
            <span aria-hidden="true">—</span>
            <span className="sr-only">{t("spinNotApplicable")}</span>
          </span>
        ) : (
          <SwitchSetting
            path={`badges.${badge.id}.gives_spin`}
            value={badge.gives_spin}
            label={t("spinLabel", { badge: name(badge) })}
            hideLabel
            compact
          />
        ),
    },
    {
      key: "people",
      header: t("columns.people"),
      align: "end",
      cell: (badge) => <People count={peopleWith(counts, badge.id)} />,
    },
  ];

  const link = (chunks: React.ReactNode) => (
    <Link href="/spin" className="font-bold text-brand-ink underline underline-offset-2">
      {chunks}
    </Link>
  );
  // When "gives a spin" does nothing right now, say so, and where to change it.
  const spinNote = !spin.enabled
    ? t.rich("spinOff", { link })
    : !spin.on_badge && !spin.on_milestone
      ? t.rich("spinOffBoth", { link })
      : !spin.on_badge
        ? t.rich("spinOffBadge", { link })
        : !spin.on_milestone
          ? t.rich("spinOffMilestone", { link })
          : null;

  return (
    <Panel id="badges-heading" title={t("heading")} icon={Star} lead={t("lead")} flush>
      {spinNote ? <p className="px-4.5 text-caption text-muted">{spinNote}</p> : null}
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={badges}
        rowKey={(badge) => badge.id}
        bare
        stackBelow={960}
        className="border-t border-border"
      />
    </Panel>
  );
}
