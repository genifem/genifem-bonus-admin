"use client";

import type { Schemas } from "@crewstars/api-client";
import { Check, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { coinsToUsd, formatCount, formatUsd } from "@/components/recognition/numbers";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cx } from "@/components/ui/cx";
import { Field, FieldMessage, SelectField, TextareaField } from "@/components/ui/Field";
import { FormDialog } from "@/components/ui/FormDialog";
import { Toggle } from "@/components/ui/Toggle";
import { labelClass } from "@/components/ui/controls";
import { apiDelete, apiPatch, apiPost, ApiCallError } from "@/lib/api";
import { describeFailure, placeProblems, type Problem } from "@/lib/api-errors";

import {
  checkReward,
  defaultTier,
  localName,
  REWARD_LIMITS,
  rewardDraft,
  rewardPatch,
  type RewardDraft,
  type RewardField,
  type UnlockType,
} from "./reward-form";
import { isRewardIcon, REWARD_ICONS, RewardGlyph, rewardIconTone } from "./RewardIcon";

type RewardAdminOut = Schemas["RewardAdminOut"];
type Tier = Schemas["Tier"];
type BadgeDef = Schemas["Badge"];

/** The fields the API can name in a refusal, as this form shows them. */
const API_FIELDS = [
  "name",
  "name_es",
  "description",
  "description_es",
  "icon",
  "cost",
  "per_person_monthly",
  "unlock",
] as const;
type ApiField = (typeof API_FIELDS)[number];

/** Which API field each part of the draft is checked as, to clear its message when edited. */
const FIELD_OF: Partial<Record<keyof RewardDraft, ApiField>> = {
  name: "name",
  nameEs: "name_es",
  description: "description",
  descriptionEs: "description_es",
  icon: "icon",
  cost: "cost",
  perMonth: "per_person_monthly",
  unlockType: "unlock",
  tierId: "unlock",
  badgeId: "unlock",
};

/**
 * Add or edit a reward (OP-11): its name and description (with optional Spanish, plan G8), its
 * icon, cost and per-person monthly limit, who can redeem it (anyone, from a tier up, or with a
 * badge, from the settings' lists), whether it shows in the app, and whether it is cash or a
 * gift card that goes to payroll (OP-12).
 *
 * Delete is offered when editing. The API allows it only while no request waits for the
 * reward (conflict C4): when one does - known from the table, or learnt from a 409
 * `reward_has_pending` - the same dialog offers "Hide from app" instead.
 *
 * Mount it with a `key` per opening, so each one starts from the reward (or a blank form).
 */
export function RewardDialog({
  open,
  reward,
  tiers,
  badges,
  coinValue,
  onClose,
  onDone,
}: {
  open: boolean;
  /** Null to add one. */
  reward: RewardAdminOut | null;
  tiers: readonly Tier[];
  badges: readonly BadgeDef[];
  coinValue: number;
  onClose: () => void;
  /** After a save, a delete or a hide, with what to say. */
  onDone: (message: string) => void;
}) {
  const t = useTranslations("rewards.form");
  const tRewards = useTranslations("rewards");
  const tDelete = useTranslations("rewards.delete");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const locale = useLocale();
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);

  const [draft, setDraft] = useState<RewardDraft>(() =>
    rewardDraft(reward, { tierId: defaultTier(tiers), badgeId: badges[0]?.id ?? "" }),
  );
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<Problem[]>([]);
  /** Bumped on every refused save, so focus moves to the first field in error each time. */
  const [attempt, setAttempt] = useState(0);
  const [confirm, setConfirm] = useState<"delete" | "hide" | null>(null);
  const [waiting, setWaiting] = useState(reward?.pending ?? 0);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  useEffect(() => {
    if (attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const set = <K extends keyof RewardDraft>(key: K, value: RewardDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    const field = FIELD_OF[key];
    if (field) setRefused((problems) => problems.filter((problem) => problem.field !== field));
  };

  const check = checkReward(draft);
  const mine = check.ok ? {} : check.problems;
  const { byField, general } = placeProblems(refused, API_FIELDS);
  const apiText = (problem: Problem) =>
    problem.code === "validation_failed" && problem.field
      ? t(`invalid.${problem.field as ApiField}`)
      : te.has(problem.code)
        ? te(problem.code)
        : te("generic");
  const error = (field: ApiField) => {
    const fromApi = byField[field];
    if (fromApi) return apiText(fromApi);
    const own = mine[field as RewardField];
    return tried && own ? t(`problems.${field as RewardField}`) : undefined;
  };

  const name = reward ? localName(reward, locale) : "";
  const cost = check.ok ? check.body.cost : null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    setRefused([]);
    if (!check.ok) {
      setAttempt((n) => n + 1);
      return;
    }
    const patch = reward ? rewardPatch(reward, check.body) : null;
    // Nothing changed: there is nothing to save, so it is simply done.
    if (patch && Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      const saved =
        reward && patch
          ? await apiPatch<RewardAdminOut>(`/portal/rewards/${reward.id}`, patch)
          : await apiPost<RewardAdminOut>("/portal/rewards", check.body);
      setBusy(false);
      onDone(reward ? t("saved", { name: localName(saved, locale) }) : t("added", { name: localName(saved, locale) }));
    } catch (err) {
      setBusy(false);
      setRefused(err instanceof ApiCallError ? describeFailure(err) : [{ field: null, code: "generic", values: {} }]);
      setAttempt((n) => n + 1);
    }
  }

  const failureText = (err: unknown) => {
    const code = err instanceof ApiCallError ? err.code : "generic";
    return te.has(code) ? te(code) : te("generic");
  };

  async function remove(): Promise<boolean> {
    if (!reward) return false;
    setConfirmError(null);
    try {
      await apiDelete<void>(`/portal/rewards/${reward.id}`);
    } catch (err) {
      if (err instanceof ApiCallError && err.code === "reward_has_pending") {
        // Something waits for it after all: offer to hide it instead (C4).
        const details = err.details as { pending?: unknown } | undefined;
        setWaiting(typeof details?.pending === "number" ? details.pending : Math.max(1, waiting));
        setConfirm("hide");
      } else {
        setConfirmError(failureText(err));
      }
      return false;
    }
    onDone(tDelete("deleted", { name }));
    return true;
  }

  async function hide(): Promise<boolean> {
    if (!reward) return false;
    setConfirmError(null);
    try {
      await apiPatch<RewardAdminOut>(`/portal/rewards/${reward.id}`, { active: false });
    } catch (err) {
      setConfirmError(failureText(err));
      return false;
    }
    onDone(tRewards("hidden", { name }));
    return true;
  }

  const iconChoices: string[] = isRewardIcon(draft.icon) ? [...REWARD_ICONS] : [...REWARD_ICONS, draft.icon];
  const iconName = (icon: string) => (isRewardIcon(icon) ? t(`icons.${icon}`) : t("otherIcon", { icon }));
  const unlockError = error("unlock");

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={reward ? t("editTitle", { name }) : t("addTitle")}
      closeLabel={tc("close")}
      busy={busy}
      footer={
        <>
          {reward ? (
            <Button
              type="button"
              variant="danger"
              size="console"
              className="mr-auto"
              disabled={busy}
              icon={<Trash2 aria-hidden="true" className="size-4" strokeWidth={2.2} />}
              onClick={() => {
                setConfirmError(null);
                setConfirm(waiting > 0 ? "hide" : "delete");
              }}
            >
              {t("delete")}
            </Button>
          ) : null}
          <Button type="button" variant="secondary" size="console" onClick={onClose} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={formId} size="console" loading={busy}>
            {reward ? t("save") : t("create")}
          </Button>
        </>
      }
    >
      <form id={formId} ref={form} noValidate onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
        <Field
          label={t("name")}
          value={draft.name}
          onChange={(event) => set("name", event.target.value)}
          error={error("name")}
          maxLength={REWARD_LIMITS.name}
          autoComplete="off"
          required
        />
        <Field
          label={t("nameEs")}
          hint={t("nameEsHint")}
          lang="es"
          value={draft.nameEs}
          onChange={(event) => set("nameEs", event.target.value)}
          error={error("name_es")}
          maxLength={REWARD_LIMITS.name}
          autoComplete="off"
        />
        <TextareaField
          label={t("description")}
          rows={2}
          value={draft.description}
          onChange={(event) => set("description", event.target.value)}
          error={error("description")}
          maxLength={REWARD_LIMITS.description}
        />
        <TextareaField
          label={t("descriptionEs")}
          hint={t("descriptionEsHint")}
          lang="es"
          rows={2}
          value={draft.descriptionEs}
          onChange={(event) => set("descriptionEs", event.target.value)}
          error={error("description_es")}
          maxLength={REWARD_LIMITS.description}
        />

        <fieldset className="min-w-0">
          <legend className={labelClass}>{t("icon")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {iconChoices.map((icon) => {
              const chosen = draft.icon === icon;
              return (
                <label
                  key={icon}
                  title={iconName(icon)}
                  className={cx(
                    "relative flex size-11 cursor-pointer items-center justify-center rounded-lg border-2",
                    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink",
                    chosen ? cx(rewardIconTone(icon), "border-current") : "border-control-border bg-surface-raised text-foreground",
                  )}
                >
                  <input
                    type="radio"
                    name={`${formId}-icon`}
                    value={icon}
                    checked={chosen}
                    onChange={() => set("icon", icon)}
                    className="sr-only"
                  />
                  <RewardGlyph icon={icon} className="size-5.5" />
                  <span className="sr-only">{iconName(icon)}</span>
                  {chosen ? (
                    <Check
                      aria-hidden="true"
                      className="absolute -right-1.5 -top-1.5 size-4.5 rounded-full bg-foreground p-0.5 text-surface-raised"
                      strokeWidth={3.2}
                    />
                  ) : null}
                </label>
              );
            })}
          </div>
          {error("icon") ? <FieldMessage error={error("icon")} /> : null}
        </fieldset>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("cost")}
            hint={
              cost !== null
                ? t("costHint", { usd: formatUsd(coinsToUsd(cost, coinValue), locale), rate: formatUsd(coinValue, locale) })
                : t("costHintNoRate")
            }
            inputMode="numeric"
            autoComplete="off"
            maxLength={9}
            value={draft.cost}
            onChange={(event) => set("cost", event.target.value)}
            error={error("cost")}
            required
          />
          <Field
            label={t("perMonth")}
            hint={t("perMonthHint")}
            inputMode="numeric"
            autoComplete="off"
            maxLength={3}
            value={draft.perMonth}
            onChange={(event) => set("perMonth", event.target.value)}
            error={error("per_person_monthly")}
            required
          />
        </div>

        <SelectField
          label={t("unlock")}
          value={draft.unlockType}
          onChange={(event) => set("unlockType", event.target.value as UnlockType)}
          error={draft.unlockType === "none" ? unlockError : undefined}
        >
          <option value="none">{t("unlockTypes.none")}</option>
          <option value="tier">{t("unlockTypes.tier")}</option>
          <option value="badge">{t("unlockTypes.badge")}</option>
        </SelectField>
        {draft.unlockType === "tier" ? (
          <SelectField
            label={t("tier")}
            value={draft.tierId}
            onChange={(event) => set("tierId", event.target.value)}
            error={unlockError}
          >
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {t("tierOption", { name: localName(tier, locale), min: formatCount(tier.min, locale) })}
              </option>
            ))}
          </SelectField>
        ) : null}
        {draft.unlockType === "badge" ? (
          <SelectField
            label={t("badge")}
            hint={badges.length === 0 ? t("noBadges") : undefined}
            value={draft.badgeId}
            onChange={(event) => set("badgeId", event.target.value)}
            error={unlockError}
          >
            {badges.map((badge) => (
              <option key={badge.id} value={badge.id}>
                {localName(badge, locale)}
              </option>
            ))}
          </SelectField>
        ) : null}

        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <Toggle
            checked={draft.active}
            onChange={(next) => set("active", next)}
            label={t("active")}
            description={t("activeHint")}
          />
          <Toggle
            checked={draft.isCash}
            onChange={(next) => set("isCash", next)}
            label={t("cash")}
            description={t("cashHint")}
          />
        </div>

        {general.length > 0 ? <Alert>{general.map(apiText).join(" ")}</Alert> : null}
      </form>

      {confirm && reward ? (
        <ConfirmDialog
          title={confirm === "delete" ? tDelete("title", { name }) : tDelete("blockedTitle", { name })}
          confirmLabel={confirm === "delete" ? tDelete("confirm") : tDelete("hide")}
          cancelLabel={tc("cancel")}
          tone={confirm === "delete" ? "danger" : "primary"}
          error={confirmError}
          // Hiding what is already hidden would change nothing.
          confirmDisabled={confirm === "hide" && !reward.active}
          onConfirm={confirm === "delete" ? remove : hide}
          onClose={() => setConfirm(null)}
        >
          {confirm === "delete" ? (
            <p>{tDelete("body")}</p>
          ) : (
            <p>
              {reward.active
                ? tDelete("blocked", { count: waiting })
                : tDelete("alreadyHidden", { count: waiting })}
            </p>
          )}
        </ConfirmDialog>
      ) : null}
    </FormDialog>
  );
}
