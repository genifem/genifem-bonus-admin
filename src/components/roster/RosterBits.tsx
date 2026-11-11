"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Alert, Button, cx, FormDialog, SelectField } from "@/components/ui";
import { ApiCallError } from "@/lib/api";
import { describeFailure, placeProblems, type Problem } from "@/lib/api-errors";

import type { Role } from "./roster-query";
import { ZONES, zoneKey } from "./zones";

/** The pieces the Roster tabs share: role chips, time zones, and how a refused save is said. */

/** The role chips of plan §13: director lilac, supervisor sky, GM peach, shift mint, crew
 *  neutral. Each pair holds 4.5:1 (packages/shared tokens.test.ts). */
const ROLE_TONES: Record<Role, string> = {
  director: "bg-lilac text-lilac-ink",
  supervisor: "bg-sky text-sky-ink",
  gm: "bg-peach text-peach-ink",
  shift: "bg-mint text-mint-ink",
  crew: "bg-surface text-foreground",
};

export function RoleChip({ role }: { role: Role }) {
  const t = useTranslations("roster.roles");
  return (
    <span
      className={cx(
        "inline-flex min-h-6 items-center whitespace-nowrap rounded-full px-2.5 text-xs font-extrabold",
        ROLE_TONES[role],
      )}
    >
      {t(role)}
    </span>
  );
}

/** A time zone as an owner reads it: "Eastern (America/New_York)", the default, or a zone
 *  the API holds that is not on the list, as it is. */
export function useZoneLabel() {
  const t = useTranslations("roster.zones");
  return useCallback(
    (tz: string | null | undefined) => {
      if (!tz) return t("default");
      const key = zoneKey(tz);
      return key ? t("named", { zone: t(key), id: tz }) : tz;
    },
    [t],
  );
}

export function TimeZoneField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (tz: string) => void;
  error?: string;
  disabled?: boolean;
}) {
  const t = useTranslations("roster.zones");
  const label = useZoneLabel();
  const listed = ZONES.some((zone) => zone.id === value);
  return (
    <SelectField
      label={t("label")}
      hint={t("hint")}
      error={error}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t("default")}</option>
      {ZONES.map((zone) => (
        <option key={zone.id} value={zone.id}>
          {label(zone.id)}
        </option>
      ))}
      {value && !listed ? <option value={value}>{value}</option> : null}
    </SelectField>
  );
}

/** A problem in words: the form's own hint for a field the API's schema refused, otherwise
 *  `errors.<code>` with its values (whoever already holds the place). */
export function useProblemText() {
  const t = useTranslations("roster");
  const te = useTranslations("errors");
  const invalid = useTranslations("roster.invalid");
  return useCallback(
    (problem: Problem): string => {
      if (problem.code === "validation_failed" && problem.field && invalid.has(problem.field)) {
        return invalid(problem.field);
      }
      if (!te.has(problem.code)) return te("generic");
      return te(problem.code, { name: t("someone"), people: 0, ...problem.values });
    },
    [t, te, invalid],
  );
}

/**
 * A refused save, split between the fields the form shows (`fields`) and the alert above its
 * buttons. After each refusal focus goes to the first field in error inside `form`, or the
 * alert reads out.
 */
export function useProblems(fields: readonly string[], form: React.RefObject<HTMLFormElement | null>) {
  const text = useProblemText();
  const [problems, setProblems] = useState<Problem[]>([]);
  const { byField, general } = placeProblems(problems, fields);

  useEffect(() => {
    if (problems.length === 0) return;
    form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [problems, form]);

  return {
    clear: () => setProblems([]),
    fail: (err: unknown) =>
      setProblems(
        err instanceof ApiCallError
          ? describeFailure(err)
          : [{ field: null, code: "generic", values: {} }],
      ),
    fieldError: (field: string) => (byField[field] ? text(byField[field]) : undefined),
    general: general.map(text),
  };
}

export function FormProblems({ messages }: { messages: readonly string[] }) {
  if (messages.length === 0) return null;
  return (
    <Alert kind="error" className="mt-1">
      {messages.join(" ")}
    </Alert>
  );
}

/**
 * The side-panel form every Roster record is added and edited in: FormDialog (the native
 * modal dialog), with Cancel and Save in its footer, tied to the form inside by id so they
 * stay put while a long form scrolls.
 */
export function RecordDialog({
  open,
  title,
  description,
  formId,
  saveLabel,
  busy,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  formId: string;
  saveLabel: string;
  busy: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const t = useTranslations("common");
  return (
    <FormDialog
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      closeLabel={t("close")}
      busy={busy}
      footer={
        <>
          <Button type="button" variant="secondary" size="console" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button type="submit" form={formId} size="console" loading={busy}>
            {saveLabel}
          </Button>
        </>
      }
    >
      {children}
    </FormDialog>
  );
}
