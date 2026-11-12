"use client";

import { Trophy } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { NumberSetting, SwitchSetting, TextSetting, type ProblemWords } from "@/components/coins/SettingControls";
import { formatCount, formatUsd } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { localName } from "@/components/rewards/reward-form";
import { DataTable, type Column } from "@/components/ui/DataTable";

import { AWARD_RANGES, monthlyAwardCost, type Award } from "./award-rules";

/**
 * The award categories (OP-19): each one's name (and Spanish name), what its winner is
 * picked on, the prize coins and whether it is on, each saving itself as the owner types (plan
 * §9). Under them, the most the awards can pay a month across the open stores, which follows
 * the typing. `storeCount` is the open stores; null when they could not be read.
 */
export function AwardCategories({
  awards,
  coinValue,
  storeCount,
}: {
  awards: readonly Award[];
  coinValue: number;
  storeCount: number | null;
}) {
  const t = useTranslations("awards.categories");
  const locale = useLocale();
  const [typed, setTyped] = useState<Record<string, Partial<Pick<Award, "coins" | "active">>>>({});
  const [seen, setSeen] = useState(awards);
  if (seen !== awards) {
    setSeen(awards);
    setTyped({});
  }
  const live = awards.map((award) => ({ ...award, ...typed[award.id] }));
  const type = (id: string, change: Partial<Pick<Award, "coins" | "active">>) =>
    setTyped((current) => ({ ...current, [id]: { ...current[id], ...change } }));
  const name = (award: Award) => localName(award, locale);
  const nameWords: ProblemWords = { problems: { required: t("problems.name") }, rule: t("problems.nameRule") };
  const cost = monthlyAwardCost(live, storeCount ?? 0, coinValue);

  const columns: Column<Award>[] = [
    {
      key: "award",
      header: t("columns.award"),
      width: "md",
      cell: (award) => (
        <div className="flex min-w-48 flex-col gap-2">
          <TextSetting
            path={`awards.${award.id}.name`}
            value={award.name}
            label={t("name")}
            context={name(award)}
            words={nameWords}
          />
          <TextSetting
            path={`awards.${award.id}.name_es`}
            value={award.name_es}
            label={t("nameEs")}
            context={name(award)}
            showLabel
            optional
            words={nameWords}
          />
        </div>
      ),
    },
    {
      key: "metric",
      header: t("columns.metric"),
      overflow: "wrap",
      cell: (award) => <span className="text-caption">{t(`metrics.${award.metric}`)}</span>,
    },
    {
      key: "coins",
      header: t("columns.coins"),
      cell: (award) => (
        <NumberSetting
          path={`awards.${award.id}.coins`}
          value={award.coins}
          range={AWARD_RANGES.coins}
          label={t("coinsLabel", { award: name(award) })}
          unit={t("coins")}
          width="sm"
          compact
          onLive={(coins) => type(award.id, { coins })}
        />
      ),
    },
    {
      key: "active",
      header: t("columns.active"),
      cell: (award) => (
        <SwitchSetting
          path={`awards.${award.id}.active`}
          value={award.active}
          label={t("activeLabel", { award: name(award) })}
          hideLabel
          compact
          onLive={(active) => type(award.id, { active })}
        />
      ),
    },
  ];

  return (
    <Panel id="categories-heading" title={t("heading")} icon={Trophy} lead={t("lead")} flush>
      <DataTable
        caption={t("caption")}
        columns={columns}
        rows={awards}
        rowKey={(award) => award.id}
        bare
        className="border-t border-border"
      />
      <p className="px-4.5 pb-4.5 text-sm text-muted tabular-nums">
        {storeCount !== null
          ? t.rich("cost", {
              coins: formatCount(cost.coins, locale),
              usd: formatUsd(cost.usd, locale),
              stores: storeCount,
              b: (chunks) => <b className="font-black text-foreground">{chunks}</b>,
            })
          : t("costUnknown")}
      </p>
    </Panel>
  );
}
