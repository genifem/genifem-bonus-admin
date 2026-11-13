"use client";

import type { Schemas } from "@crewstars/api-client";
import { Gift, Send, Users } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { formatCount, formatUsd } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { Badge } from "@/components/ui/Badge";
import { Columns } from "@/components/ui/Columns";
import { DataTable, type Column } from "@/components/ui/DataTable";

import {
  budgetEstimate,
  GIVING_ROLES,
  RANGES,
  SCOPE_KINDS,
  SCOPE_ROLES,
  worstCase,
  type GivingRole,
} from "./coin-rules";
import { ChoiceSetting, NumberSetting, SettingRow, SwitchSetting } from "./SettingControls";
import { useLive } from "./useLive";

type Rules = Schemas["Rules"];
export type CoinRules = Pick<Rules, "allowance" | "amounts" | "scope" | "upward" | "redeem" | "coin_value">;

/**
 * Coins & limits (OP-13 to OP-15), the parts an owner changes: each role's monthly kudos
 * allowance and three shout-out sizes (owners too) with the worst case for crew allowances;
 * who can recognize whom; and the redemption limits with the coin value. Every control saves
 * itself as the owner types (plan §9), and the estimates follow the typing.
 *
 * `crewCount` is GET /portal/team?role=crew's total (the crew on the roster now); null when it
 * could not be read, and then the worst case says so. `storeCount` is the open stores.
 */
export function CoinsSettings({
  rules,
  crewCount,
  storeCount,
}: {
  rules: CoinRules;
  crewCount: number | null;
  storeCount: number | null;
}) {
  const t = useTranslations("coins");
  const locale = useLocale();
  const ids = useId();
  const [crewAllowance, setCrewAllowance] = useLive(rules.allowance.crew);
  const [storeBudget, setStoreBudget] = useLive(rules.redeem.store_budget);
  const [coinValue, setCoinValue] = useLive(rules.coin_value);

  const count = (value: number) => formatCount(value, locale);
  const usd = (value: number) => formatUsd(value, locale);
  const roleName = (role: GivingRole) => t(`roles.${role}`);
  const worst = crewCount !== null ? worstCase(crewCount, crewAllowance, coinValue) : null;
  const budget = budgetEstimate(storeBudget, coinValue, storeCount ?? 0);

  const columns: Column<GivingRole>[] = [
    {
      key: "role",
      header: t("allowance.columns.role"),
      overflow: "nowrap",
      cell: (role) => <b className="font-extrabold">{roleName(role)}</b>,
    },
    {
      key: "allowance",
      header: t("allowance.columns.allowance"),
      stack: "full",
      cell: (role) => (
        <NumberSetting
          path={`allowance.${role}`}
          value={rules.allowance[role]}
          range={RANGES.allowance}
          label={t("allowance.allowanceLabel", { role: roleName(role) })}
          unit={t("units.coins")}
          compact
          onLive={role === "crew" ? setCrewAllowance : undefined}
        />
      ),
    },
    {
      key: "amounts",
      header: t("allowance.columns.amounts"),
      stack: "full",
      cell: (role) => (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-start gap-2">
            {[0, 1, 2].map((index) => (
              <NumberSetting
                key={index}
                path={`amounts.${role}.${index}`}
                value={rules.amounts[role][index] ?? 1}
                range={RANGES.amount}
                label={t("allowance.amountLabel", { role: roleName(role), n: index + 1 })}
                width="sm"
                compact
              />
            ))}
          </div>
          {role === "owner" ? <span className="text-caption text-muted">{t("allowance.ownerCustom")}</span> : null}
        </div>
      ),
    },
  ];

  return (
    <>
      <Panel id="allowance-heading" title={t("allowance.heading")} icon={Send} flush>
        <DataTable
          caption={t("allowance.caption")}
          columns={columns}
          rows={GIVING_ROLES}
          rowKey={(role) => role}
          bare
          className="border-t border-border"
        />
        <p className="px-4.5 pb-4.5 text-sm text-muted tabular-nums">
          {worst !== null
            ? t.rich("allowance.worstCase", {
                coins: count(worst.coins),
                crew: crewCount ?? 0,
                usd: usd(worst.usd),
                b: (chunks) => <b className="font-black text-foreground">{chunks}</b>,
              })
            : t("allowance.worstCaseUnknown")}
        </p>
      </Panel>

      {/* Side by side on a wide page, where each card still has a setting's words and its
          control on one line. */}
      <Columns layout="settings">
        <Panel id="scope-heading" title={t("scope.heading")} icon={Users} lead={t("scope.lead")}>
          <div className="flex flex-col">
            {SCOPE_ROLES.map((role) => (
              <SettingRow key={role} title={roleName(role)} hint={t("scope.canRecognize")} hintId={`${ids}-scope-${role}`}>
                <ChoiceSetting
                  path={`scope.${role}`}
                  value={rules.scope[role]}
                  label={t("scope.label", { role: roleName(role) })}
                  describedBy={`${ids}-scope-${role}`}
                  options={SCOPE_KINDS.map((kind) => ({ value: kind, label: t(`scope.kinds.${kind}`) }))}
                />
              </SettingRow>
            ))}
            <SettingRow title={t("scope.owners")} hint={t("scope.ownersHint")}>
              <Badge tone="success" className="min-h-8 px-3 text-sm">
                {t("scope.everyone")}
              </Badge>
            </SettingRow>
            <div className="border-t border-border pt-2">
              <SwitchSetting
                path="upward"
                value={rules.upward}
                label={t("scope.upward")}
                description={t("scope.upwardHint")}
              />
            </div>
          </div>
        </Panel>

        <Panel id="limits-heading" title={t("limits.heading")} icon={Gift}>
          <div className="flex flex-col">
            <SettingRow title={t("limits.maxCoins")} hint={t("limits.maxCoinsHint")} hintId={`${ids}-max-coins`}>
              <NumberSetting
                path="redeem.max_coins"
                value={rules.redeem.max_coins}
                range={RANGES.maxCoins}
                label={t("limits.maxCoins")}
                unit={t("units.coins")}
                describedBy={`${ids}-max-coins`}
              />
            </SettingRow>
            <SettingRow title={t("limits.maxRewards")} hint={t("limits.maxRewardsHint")} hintId={`${ids}-max-rewards`}>
              <NumberSetting
                path="redeem.max_rewards"
                value={rules.redeem.max_rewards}
                range={RANGES.maxRewards}
                label={t("limits.maxRewards")}
                unit={t("units.rewards")}
                width="sm"
                describedBy={`${ids}-max-rewards`}
              />
            </SettingRow>
            <SettingRow
              title={t("limits.storeBudget")}
              hint={
                <span className="tabular-nums">
                  {storeCount !== null
                    ? t("limits.storeBudgetHint", {
                        perStore: usd(budget.perStore),
                        total: usd(budget.total),
                        stores: storeCount,
                      })
                    : t("limits.storeBudgetHintOne", { perStore: usd(budget.perStore) })}
                </span>
              }
              hintId={`${ids}-store-budget`}
            >
              <NumberSetting
                path="redeem.store_budget"
                value={rules.redeem.store_budget}
                range={RANGES.storeBudget}
                label={t("limits.storeBudget")}
                unit={t("units.coins")}
                describedBy={`${ids}-store-budget`}
                onLive={setStoreBudget}
              />
            </SettingRow>
            <div className="border-b border-border py-2">
              <SwitchSetting
                path="redeem.approval"
                value={rules.redeem.approval}
                label={t("limits.approval")}
                description={t("limits.approvalHint")}
              />
            </div>
            <SettingRow title={t("limits.coinValue")} hint={t("limits.coinValueHint")} hintId={`${ids}-coin-value`}>
              <NumberSetting
                path="coin_value"
                value={rules.coin_value}
                range={RANGES.coinValue}
                label={t("limits.coinValue")}
                dollars
                width="sm"
                describedBy={`${ids}-coin-value`}
                onLive={setCoinValue}
              />
            </SettingRow>
          </div>
        </Panel>
      </Columns>
    </>
  );
}
