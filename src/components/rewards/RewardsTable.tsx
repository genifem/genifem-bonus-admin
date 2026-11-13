"use client";

import type { Schemas } from "@crewstars/api-client";
import { Gift, Info, Lock, Pencil, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { CoinPill } from "@/components/recognition/Chips";
import { formatCount, formatUsd } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { Toggle } from "@/components/ui/Toggle";
import { useToast } from "@/components/ui/Toast";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { apiPatch, ApiCallError } from "@/lib/api";

import { describeUnlock, localDescription, localName } from "./reward-form";
import { RewardDialog } from "./RewardDialog";
import { RewardIcon } from "./RewardIcon";

type RewardAdminOut = Schemas["RewardAdminOut"];
type Tier = Schemas["Tier"];
type BadgeDef = Schemas["Badge"];

/**
 * The Rewards table (OP-10): each reward's icon, name and description, its cost in coins and
 * dollars, what unlocks it, the per-person monthly limit, whether crew see it in the app (a
 * switch that saves at once), and Edit; with Add reward above it and the payroll note (OP-12)
 * under it. Adding and editing happen in RewardDialog (OP-11). Every change redraws the page
 * from the server.
 */
export function RewardsTable({
  rewards,
  tiers,
  badges,
  coinValue,
}: {
  rewards: readonly RewardAdminOut[];
  tiers: readonly Tier[];
  badges: readonly BadgeDef[];
  coinValue: number;
}) {
  const t = useTranslations("rewards");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  // A new key per opening, so each one starts from the reward (or a blank form).
  const [editing, setEditing] = useState<{ reward: RewardAdminOut | null; round: number }>({
    reward: null,
    round: 0,
  });

  function edit(reward: RewardAdminOut | null) {
    setEditing((was) => ({ reward, round: was.round + 1 }));
    setOpen(true);
  }

  function done(message: string) {
    setOpen(false);
    toast.show(message);
    router.refresh();
  }

  const columns: Column<RewardAdminOut>[] = [
    {
      key: "reward",
      header: t("columns.reward"),
      cell: (reward) => (
        <span className="flex items-start gap-3 spread:min-w-56 spread:max-w-96">
          <RewardIcon icon={reward.icon} />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="break-words font-extrabold">{localName(reward, locale)}</span>
              {reward.is_cash ? <Badge tone="warning">{t("payroll")}</Badge> : null}
            </span>
            {reward.description ? (
              <span className="break-words text-caption text-muted">{localDescription(reward, locale)}</span>
            ) : null}
            {reward.pending > 0 ? <Badge tone="brand">{t("waiting", { count: reward.pending })}</Badge> : null}
          </span>
        </span>
      ),
    },
    {
      key: "coins",
      header: t("columns.coins"),
      align: "end",
      cell: (reward) => <CoinPill coins={reward.cost} />,
    },
    {
      key: "usd",
      header: t("columns.usd"),
      align: "end",
      // The dollars give way first on a narrower full table; the cards still show them.
      hideBelow: "lg",
      cell: (reward) => <span className="text-caption">{formatUsd(reward.cost_usd, locale)}</span>,
    },
    {
      key: "unlock",
      header: t("columns.unlock"),
      overflow: "wrap",
      cell: (reward) => <UnlockText reward={reward} tiers={tiers} badges={badges} />,
    },
    {
      key: "perMonth",
      header: t("columns.perMonth"),
      align: "end",
      cell: (reward) => formatCount(reward.per_person_monthly, locale),
    },
    {
      key: "visible",
      header: t("columns.visible"),
      cell: (reward) => <VisibleToggle reward={reward} name={localName(reward, locale)} />,
    },
    {
      key: "actions",
      header: t("columns.actions"),
      width: "min",
      pin: "end",
      cell: (reward) => (
        <Button
          variant="secondary"
          size="console"
          icon={<Pencil aria-hidden="true" className="size-4" strokeWidth={2.2} />}
          onClick={() => edit(reward)}
        >
          {t("edit")}
          <VisuallyHidden>{` ${localName(reward, locale)}`}</VisuallyHidden>
        </Button>
      ),
    },
  ];

  return (
    <Panel
      id="rewards-heading"
      title={t("heading", { count: rewards.length })}
      icon={Gift}
      flush
      action={
        <Button
          size="console"
          icon={<Plus aria-hidden="true" className="size-4.5" strokeWidth={2.2} />}
          onClick={() => edit(null)}
        >
          {t("add")}
        </Button>
      }
    >
      {rewards.length === 0 ? (
        <div className="px-4.5">
          <EmptyState title={t("empty")} lead={t("emptyLead")} />
        </div>
      ) : (
        <DataTable
          caption={t("caption")}
          columns={columns}
          rows={rewards}
          rowKey={(reward) => reward.id}
          bare
          stackBelow={960}
          className="border-t border-border"
        />
      )}

      <p className="mx-4.5 mb-4.5 flex items-start gap-2.5 rounded-lg bg-warning-subtle p-3 text-sm text-warning-ink">
        <Info aria-hidden="true" className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
        <span>
          {t.rich("note", {
            link: (chunks) => (
              <Link href="/redemptions" className="font-extrabold underline underline-offset-2">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </p>

      <RewardDialog
        key={editing.round}
        open={open}
        reward={editing.reward}
        tiers={tiers}
        badges={badges}
        coinValue={coinValue}
        onClose={() => setOpen(false)}
        onDone={done}
      />
    </Panel>
  );
}

/** "Anyone", or the tier or badge that unlocks it with a lock beside it. A rule naming a tier
 *  or badge the settings no longer have says so. */
function UnlockText({
  reward,
  tiers,
  badges,
}: {
  reward: RewardAdminOut;
  tiers: readonly Tier[];
  badges: readonly BadgeDef[];
}) {
  const t = useTranslations("rewards.unlock");
  const locale = useLocale();
  const rule = describeUnlock(reward.unlock, { tiers, badges }, locale);
  if (rule.kind === "anyone") return <span className="text-muted">{t("anyone")}</span>;
  const text = rule.missing
    ? t("missing", { name: rule.name })
    : rule.kind === "tier"
      ? t("tier", { name: rule.name })
      : t("badge", { name: rule.name });
  return (
    <span className={rule.missing ? "inline-flex items-start gap-1.5 font-bold text-danger-ink" : "inline-flex items-start gap-1.5"}>
      <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={2.4} />
      <span>{text}</span>
    </span>
  );
}

/**
 * "Visible in app" (OP-10): hides a reward from the app, or shows it again, at once. Hiding
 * never touches requests already made (acceptance test 16). The switch moves straight away
 * and moves back if the API refuses.
 */
function VisibleToggle({ reward, name }: { reward: RewardAdminOut; name: string }) {
  const t = useTranslations("rewards");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(reward.active);
  const [seen, setSeen] = useState(reward.active);
  const [busy, setBusy] = useState(false);

  // The page was drawn again (a save, another owner): show what the API holds.
  if (reward.active !== seen) {
    setSeen(reward.active);
    setChecked(reward.active);
  }

  async function flip(next: boolean) {
    if (busy) return;
    setChecked(next);
    setBusy(true);
    try {
      await apiPatch<RewardAdminOut>(`/portal/rewards/${reward.id}`, { active: next });
      toast.show(next ? t("shown", { name }) : t("hidden", { name }));
      router.refresh();
    } catch (err) {
      setChecked(!next);
      const code = err instanceof ApiCallError ? err.code : "generic";
      toast.show(te.has(code) ? te(code) : te("generic"), "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Toggle checked={checked} onChange={(next) => void flip(next)} label={t("show", { name })} hideLabel />
  );
}
