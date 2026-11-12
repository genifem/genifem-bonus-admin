"use client";

import type { Schemas } from "@crewstars/api-client";
import { Eye, FerrisWheel, Gift, Plus, Power, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId, useState } from "react";

import {
  ChoiceSetting,
  NumberSetting,
  SaveMark,
  SettingRow,
  SwitchSetting,
  TextSetting,
  useProblemText,
  type ProblemWords,
} from "@/components/coins/SettingControls";
import { patchSettings, useAutosave } from "@/components/coins/useAutosave";
import { useLive } from "@/components/coins/useLive";
import { formatUsd, numberLocale } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { FieldMessage } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { useToast } from "@/components/ui/Toast";

import {
  averagePerSpin,
  canAdd,
  canRemove,
  hasAmount,
  hasItems,
  kindChanges,
  MAX_PRIZES,
  newPrizeId,
  odds,
  PRIZE_KINDS,
  prizeLabel,
  samePrizeIds,
  SPIN_RANGES,
  totalWeight,
  wheelBadge,
  withKind,
  withPrizeAdded,
  withPrizeRemoved,
  type Prize,
  type PrizeKind,
} from "./spin-rules";
import { Wheel } from "./Wheel";

type Spin = Schemas["Spin"];
type Badge = Pick<Schemas["Badge"], "id" | "name" | "name_es" | "rule">;
type SettingsOut = Schemas["SettingsOut"];

/** The prizes in a PATCH's answer, when it has them. */
function prizesOf(out: unknown): Prize[] | null {
  const prizes = (out as Partial<SettingsOut> | null)?.rules?.spin?.prizes;
  return Array.isArray(prizes) ? prizes : null;
}

/** The prize list's heading takes focus once a row has gone with the button that removed it. */
function focusPrizes() {
  const heading = document.getElementById("prizes-heading");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/**
 * Spin the wheel (OP-16, OP-17, plan D19): the master switch, when crew earn a spin, the wheel
 * as they see it, and the prizes with their odds. Every control saves itself as the owner types
 * (plan §9), field by field; adding or removing a prize sends the whole list (`spin.prizes`)
 * with the new one's id, since the list itself changes.
 *
 * The rows are the prizes the API holds (`saved`, from the page and then from each answer that
 * changes the list), so a prize appears or goes once the API has it. What the owner types is
 * laid over them (`typed`) for the odds, the average and the wheel, which follow the typing.
 */
export function SpinSettings({ spin, coinValue, badges }: { spin: Spin; coinValue: number; badges: readonly Badge[] }) {
  const t = useTranslations("spin");
  const locale = useLocale();
  const toast = useToast();
  const ids = useId();
  const [enabled, setEnabled] = useLive(spin.enabled);
  const [saved, setSaved] = useState(spin.prizes);
  const [typed, setTyped] = useState<Record<string, Partial<Prize>>>({});
  const [seen, setSeen] = useState(spin.prizes);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  if (seen !== spin.prizes) {
    // The page was drawn again: the API's prizes are the truth again.
    setSeen(spin.prizes);
    setSaved(spin.prizes);
    setTyped({});
  }

  const badgeId = wheelBadge(badges);
  const badge = badges.find((item) => item.id === badgeId);
  const badgeName = badge ? (locale.startsWith("es") && badge.name_es ? badge.name_es : badge.name) : "";
  const live = saved.map((prize) => ({ ...prize, ...typed[prize.id] }));
  const chances = odds(live);
  const average = averagePerSpin(live, coinValue);
  const labels = live.map((prize) => prizeLabel(prize, locale));
  const type = (id: string, change: Partial<Prize>) =>
    setTyped((current) => ({ ...current, [id]: { ...current[id], ...change } }));

  const adopt = (out: unknown) => {
    const prizes = prizesOf(out);
    if (prizes) setSaved(prizes);
    return prizes;
  };

  // The list itself: sent whole when a prize is added or removed, the same autosave as every
  // other control (one save at a time, `settings_busy` tried again, a 422 said in words).
  const list = useAutosave<Prize[], Prize[]>({
    path: "spin.prizes",
    value: saved,
    parse: (next) => ({ ok: true, value: next }),
    format: (next) => next,
    delayMs: 0,
    equal: samePrizeIds,
    send: async (changes) => {
      const before = saved;
      const out = await patchSettings(changes);
      const after = adopt(out) ?? [];
      const added = after.find((prize) => !before.some((old) => old.id === prize.id));
      const removed = before.find((old) => !after.some((prize) => prize.id === old.id));
      if (added) {
        setJustAdded(added.id);
        toast.show(t("prizes.added"));
      } else if (removed) {
        focusPrizes();
        toast.show(t("prizes.removed", { label: prizeLabel(removed, locale) }));
      }
      return out;
    },
  });
  const listBusy = list.status.kind === "pending" || list.status.kind === "saving";
  const listProblem = useProblemText({ words: { rule: t("prizes.problems.listRule") } })(list.status);

  const add = () => {
    const next = withPrizeAdded(live, newPrizeId(live.map((prize) => prize.id)));
    if (next) list.change(next);
  };
  const remove = (id: string) => {
    const next = withPrizeRemoved(live, id);
    if (next) list.change(next);
  };

  const count = live.length;
  const percent = (value: number) =>
    t("prizes.odds", {
      value: new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 1 }).format(value),
    });
  const row = (prize: Prize) => saved.findIndex((item) => item.id === prize.id) + 1;
  const nameWords: ProblemWords = {
    problems: { required: t("prizes.problems.name") },
    rule: t("prizes.problems.nameRule"),
  };
  // The badge type only while there is a badge for it to give (or this prize is one already).
  const kindOptions = (prize: Prize) =>
    PRIZE_KINDS.filter((kind) => kind !== "badge" || badgeId !== null || prize.kind === "badge").map((kind) => ({
      value: kind,
      label: t(`prizes.kinds.${kind}`),
    }));

  const columns: Column<Prize>[] = [
    {
      key: "prize",
      header: t("prizes.columns.prize"),
      width: "md",
      cell: (prize) => (
        <div className="flex min-w-44 flex-col gap-2">
          <TextSetting
            path={`spin.prizes.${prize.id}.label`}
            value={prize.label}
            label={t("prizes.label")}
            context={t("prizes.row", { n: row(prize) })}
            words={nameWords}
            autoFocus={prize.id === justAdded}
            onLive={(label) => type(prize.id, { label: label ?? prize.label })}
          />
          <TextSetting
            path={`spin.prizes.${prize.id}.label_es`}
            value={prize.label_es}
            label={t("prizes.labelEs")}
            context={t("prizes.row", { n: row(prize) })}
            showLabel
            optional
            words={nameWords}
            onLive={(label) => type(prize.id, { label_es: label })}
          />
        </div>
      ),
    },
    {
      key: "type",
      header: t("prizes.columns.type"),
      cell: (prize) => (
        <ChoiceSetting<PrizeKind>
          path={`spin.prizes.${prize.id}.kind`}
          value={prize.kind}
          label={t("prizes.type", { n: row(prize) })}
          options={kindOptions(prize)}
          send={async (changes) => {
            const kind = changes[`spin.prizes.${prize.id}.kind`] as PrizeKind;
            const out = await patchSettings(kindChanges(prize, kind, badgeId));
            adopt(out);
            return out;
          }}
          onLive={(kind) => {
            const next = withKind({ ...prize, ...typed[prize.id] }, kind, badgeId);
            type(prize.id, { kind: next.kind, amount: next.amount, badge_id: next.badge_id });
          }}
        />
      ),
    },
    {
      key: "amount",
      header: t("prizes.columns.amount"),
      cell: (prize) =>
        hasAmount(prize.kind) ? (
          <NumberSetting
            path={`spin.prizes.${prize.id}.amount`}
            value={prize.amount}
            range={SPIN_RANGES.amount}
            label={t("prizes.amount", { n: row(prize) })}
            unit={prize.kind === "coins" ? t("units.coins") : t("units.kudos")}
            width="sm"
            compact
            words={{ rule: t("prizes.problems.amountRule") }}
            onLive={(amount) => type(prize.id, { amount })}
          />
        ) : (
          <span className="text-caption text-muted">
            {prize.kind === "item" ? t("prizes.item") : t("prizes.badge", { name: badgeName })}
          </span>
        ),
    },
    {
      key: "weight",
      header: t("prizes.columns.weight"),
      cell: (prize) => (
        <NumberSetting
          path={`spin.prizes.${prize.id}.weight`}
          value={prize.weight}
          range={SPIN_RANGES.weight}
          label={t("prizes.weight", { n: row(prize) })}
          width="sm"
          compact
          validate={(weight) =>
            weight === 0 && totalWeight(live.filter((other) => other.id !== prize.id)) === 0 ? "total" : null
          }
          words={{
            problems: { total: t("prizes.problems.total") },
            rule: t("prizes.problems.weightRule"),
          }}
          onLive={(weight) => type(prize.id, { weight })}
        />
      ),
    },
    {
      key: "odds",
      header: t("prizes.columns.odds"),
      align: "end",
      overflow: "nowrap",
      cell: (prize) => (
        <b className="font-black tabular-nums">{percent(chances[row(prize) - 1] ?? 0)}</b>
      ),
    },
    {
      key: "remove",
      header: t("prizes.columns.remove"),
      width: "min",
      cell: (prize) => (
        <IconButton
          label={t("prizes.remove", { n: row(prize), label: prizeLabel({ ...prize, ...typed[prize.id] }, locale) })}
          size={40}
          variant="ghost"
          disabled={!canRemove(count) || listBusy}
          onClick={() => remove(prize.id)}
        >
          <Trash2 aria-hidden="true" className="size-4" strokeWidth={2.2} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <Panel id="switch-heading" title={t("switch.heading")} icon={Power}>
        <SwitchSetting
          path="spin.enabled"
          value={spin.enabled}
          label={t("switch.label")}
          description={t("switch.hint")}
          onLive={setEnabled}
        />
        {!enabled ? <Alert kind="warning">{t("switch.off")}</Alert> : null}
      </Panel>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <Panel id="earn-heading" title={t("earn.heading")} icon={FerrisWheel}>
          <div className="flex flex-col">
            <SettingRow title={t("earn.everyCoins")} hint={t("earn.everyCoinsHint")} hintId={`${ids}-every`}>
              <NumberSetting
                path="spin.every_coins"
                value={spin.every_coins}
                range={SPIN_RANGES.everyCoins}
                label={t("earn.everyCoins")}
                unit={t("units.coins")}
                describedBy={`${ids}-every`}
              />
            </SettingRow>
            <div className="border-b border-border py-2">
              <SwitchSetting
                path="spin.on_badge"
                value={spin.on_badge}
                label={t("earn.onBadge")}
                description={t("earn.onBadgeHint")}
              />
            </div>
            <div className="border-b border-border py-2">
              <SwitchSetting
                path="spin.on_milestone"
                value={spin.on_milestone}
                label={t("earn.onMilestone")}
                description={t("earn.onMilestoneHint")}
              />
            </div>
            <SettingRow title={t("earn.maxPerMonth")} hint={t("earn.maxPerMonthHint")} hintId={`${ids}-max`}>
              <NumberSetting
                path="spin.max_per_month"
                value={spin.max_per_month}
                range={SPIN_RANGES.maxPerMonth}
                label={t("earn.maxPerMonth")}
                unit={t("units.spins")}
                width="sm"
                describedBy={`${ids}-max`}
              />
            </SettingRow>
          </div>
        </Panel>

        <Panel id="preview-heading" title={t("preview.heading")} icon={Eye} lead={t("preview.lead")}>
          <div className="pt-3">
            <Wheel
              labels={labels}
              name={t("preview.name", { count: labels.length, prizes: labels.join(", ") })}
            />
          </div>
        </Panel>
      </div>

      <Panel
        id="prizes-heading"
        title={t("prizes.heading")}
        icon={Gift}
        lead={t("prizes.lead", { max: MAX_PRIZES })}
        flush
        action={
          <div className="flex items-center gap-2">
            <SaveMark status={list.status} />
            <Button
              variant="secondary"
              size="console"
              icon={<Plus aria-hidden="true" className="size-4" strokeWidth={2.4} />}
              disabled={!canAdd(count) || listBusy}
              loading={list.status.kind === "saving"}
              onClick={add}
            >
              {t("prizes.add")}
            </Button>
          </div>
        }
      >
        {!canAdd(count) ? <p className="px-4.5 text-caption text-muted">{t("prizes.full", { max: MAX_PRIZES })}</p> : null}
        {listProblem ? (
          <div className="px-4.5">
            <FieldMessage error={listProblem} />
          </div>
        ) : null}
        <DataTable
          caption={t("prizes.caption")}
          columns={columns}
          rows={saved}
          rowKey={(prize) => prize.id}
          bare
          className="border-t border-border"
        />
        <p className="px-4.5 pb-4.5 text-sm text-muted tabular-nums">
          {t.rich(hasItems(live) ? "prizes.averageItems" : "prizes.average", {
            coins: new Intl.NumberFormat(numberLocale(locale), { maximumFractionDigits: 1 }).format(average.coins),
            usd: formatUsd(average.usd, locale),
            b: (chunks) => <b className="font-black text-foreground">{chunks}</b>,
          })}
        </p>
      </Panel>
    </>
  );
}
