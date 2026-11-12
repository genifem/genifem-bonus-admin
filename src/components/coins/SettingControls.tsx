"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useId } from "react";

import { formatCount, formatUsd } from "@/components/recognition/numbers";
import { cx } from "@/components/ui/cx";
import { FieldMessage } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { Toggle } from "@/components/ui/Toggle";
import { inlineInputClass, inputClass } from "@/components/ui/controls";

import type { Parsed, SaveStatus } from "./autosave";
import { formatDollars, NAME_MAX, parseDollars, parseName, parseWhole, type Range } from "./coin-rules";
import { useAutosave } from "./useAutosave";

/**
 * The controls of the rule pages, each saving itself (useAutosave): a number box, a name box,
 * a switch and a list. Each shows how its save went beside it - a spinner, then a quiet
 * "Saved" - and says why when it could not save, under it, in the owner's language.
 */

/** A page's own words for a control's problems: by problem key for its own checks
 *  (`validate`), and `rule` for when the API refused the field (the range, by default). */
export interface ProblemWords {
  problems?: Record<string, string>;
  rule?: string;
}

/** What to say under a control that did not save, or null. Exported for a page's own saves
 *  (the prize list's) that draw their problem in their own place. */
export function useProblemText({
  range,
  dollars = false,
  words,
}: { range?: Range; dollars?: boolean; words?: ProblemWords } = {}) {
  const t = useTranslations("coins.save");
  const te = useTranslations("errors");
  const locale = useLocale();
  const say = (value: number) => (dollars ? formatUsd(value, locale) : formatCount(value, locale));
  const inRange = () =>
    range ? t("problems.range", { min: say(range.min), max: say(range.max) }) : te("settings_invalid");
  // The API's refusal names only the field, so it is said as the field's whole rule.
  const rule = () => words?.rule ?? inRange();
  return (status: SaveStatus): string | null => {
    if (status.kind === "invalid") {
      const own = words?.problems?.[status.problem];
      if (own) return own;
      return status.problem === "range"
        ? inRange()
        : status.problem === "cents"
          ? t("problems.cents")
          : status.problem === "whole"
            ? t("problems.whole")
            : status.problem === "long"
              ? t("problems.long", { max: NAME_MAX })
              : t("problems.required");
    }
    if (status.kind !== "failed") return null;
    // The API named this field: say its rule in the owner's words rather than the API's English.
    const reason =
      status.code === "settings_invalid" && status.message !== null
        ? rule()
        : te.has(status.code)
          ? te(status.code)
          : te("generic");
    return `${t("notSaved")} ${reason}`;
  };
}

/** How the save is going: a spinner while it saves, then "Saved" for a moment. A live region,
 *  so a screen reader hears it too. `compact` draws only the tick (a table cell). */
export function SaveMark({ status, compact = false }: { status: SaveStatus; compact?: boolean }) {
  const t = useTranslations("coins.save");
  return (
    <span role="status" className="inline-flex min-h-5 min-w-5 items-center gap-1 text-caption text-muted">
      {status.kind === "saving" ? (
        <>
          <Spinner className="size-3.5" />
          <span className="sr-only">{t("saving")}</span>
        </>
      ) : null}
      {status.kind === "saved" ? (
        <>
          <Check aria-hidden="true" className="size-4 shrink-0 text-success-ink" strokeWidth={2.6} />
          <span className={compact ? "sr-only" : undefined}>{t("saved")}</span>
        </>
      ) : null}
    </span>
  );
}

/**
 * A number setting: whole coins, or dollars and cents. Checked against `range` as it is typed
 * (the spec's "Allowed" column; the API checks again), saved after a pause or on leaving the
 * box. `onLive` hears every good value as it is typed, for the estimates beside it.
 */
export function NumberSetting({
  path,
  value,
  range,
  label,
  dollars = false,
  unit,
  width = "md",
  compact = false,
  describedBy,
  onLive,
  validate,
  words,
  send,
  className,
}: {
  path: string;
  value: number;
  range: Range;
  /** The control's name for a screen reader; the page shows it as a row title or a column. */
  label: string;
  dollars?: boolean;
  /** After the box: "coins", "rewards". */
  unit?: string;
  width?: "sm" | "md";
  compact?: boolean;
  /** The id of the row's description, read with the box. */
  describedBy?: string;
  onLive?: (value: number) => void;
  /** A check of the page's own beyond the range (a tier above the one before it): the
   *  problem's key, said through `words`, or null when the value is fine. */
  validate?: (value: number) => string | null;
  words?: ProblemWords;
  /** In place of the plain PATCH of `path` (useAutosave). */
  send?: (changes: Record<string, unknown>) => Promise<unknown>;
  className?: string;
}) {
  const id = useId();
  const parse = (raw: string): Parsed<number> => {
    const parsed = dollars ? parseDollars(raw, range) : parseWhole(raw, range);
    const problem = parsed.ok && validate ? validate(parsed.value) : null;
    return problem ? { ok: false, problem } : parsed;
  };
  const field = useAutosave<string, number>({
    path,
    value,
    parse,
    format: dollars ? formatDollars : String,
    send,
  });
  const problem = useProblemText({ range, dollars, words })(field.status);
  const messageId = `${id}-message`;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <div className="flex items-center gap-2">
        <label htmlFor={id} className="sr-only">
          {label}
        </label>
        {dollars ? (
          <span aria-hidden="true" className="text-sm font-bold text-muted">
            $
          </span>
        ) : null}
        <input
          id={id}
          inputMode={dollars ? "decimal" : "numeric"}
          autoComplete="off"
          spellCheck={false}
          maxLength={dollars ? 6 : 9}
          value={field.draft}
          onChange={(event) => {
            const next = event.target.value;
            field.change(next);
            const parsed = parse(next);
            if (parsed.ok) onLive?.(parsed.value);
          }}
          onBlur={field.flush}
          aria-invalid={problem ? true : undefined}
          aria-describedby={[describedBy, problem ? messageId : null].filter(Boolean).join(" ") || undefined}
          className={cx(inlineInputClass, "text-right tabular-nums", width === "sm" ? "w-20" : "w-28")}
        />
        {unit ? <span className="text-caption text-muted">{unit}</span> : null}
        <SaveMark status={field.status} compact={compact} />
      </div>
      {problem ? (
        <div className={compact ? "max-w-48" : "max-w-72"}>
          <FieldMessage id={messageId} error={problem} />
        </div>
      ) : null}
    </div>
  );
}

/** An on/off setting, saved the moment it is flipped. The whole row is its label; in a table
 *  cell (`hideLabel`) the column says what it is, and the label is for a screen reader. */
export function SwitchSetting({
  path,
  value,
  label,
  description,
  hideLabel = false,
  compact = false,
  onLive,
}: {
  path: string;
  value: boolean;
  label: string;
  description?: string;
  hideLabel?: boolean;
  compact?: boolean;
  /** Hears every flip, for what the page works out from it. */
  onLive?: (value: boolean) => void;
}) {
  const field = useAutosave<boolean, boolean>({
    path,
    value,
    parse: (next) => ({ ok: true, value: next }),
    format: (next) => next,
    delayMs: 0,
  });
  const problem = useProblemText()(field.status);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <Toggle
          checked={field.draft}
          onChange={(next) => {
            field.change(next);
            onLive?.(next);
          }}
          label={label}
          description={description}
          hideLabel={hideLabel}
          className={hideLabel ? "shrink-0" : "min-w-0 flex-1"}
        />
        <SaveMark status={field.status} compact={compact} />
      </div>
      {problem ? (
        <div className={compact ? "max-w-48" : undefined}>
          <FieldMessage error={problem} />
        </div>
      ) : null}
    </div>
  );
}

/** A choice from a list, saved the moment it is picked. */
export function ChoiceSetting<V extends string>({
  path,
  value,
  label,
  options,
  describedBy,
  send,
  onLive,
  words,
  width = "md",
}: {
  path: string;
  value: V;
  /** The list's name for a screen reader. */
  label: string;
  options: readonly { value: V; label: string }[];
  describedBy?: string;
  /** In place of the plain PATCH of `path` (useAutosave). */
  send?: (changes: Record<string, unknown>) => Promise<unknown>;
  /** Hears every pick, for what the page works out from it. */
  onLive?: (value: V) => void;
  words?: ProblemWords;
  /** `sm` for a table cell. */
  width?: "sm" | "md";
}) {
  const id = useId();
  const field = useAutosave<string, V>({
    path,
    value,
    parse: (next) =>
      options.some((option) => option.value === next)
        ? { ok: true, value: next as V }
        : { ok: false, problem: "required" },
    format: (next) => next,
    delayMs: 0,
    send,
  });
  const problem = useProblemText({ words })(field.status);
  const messageId = `${id}-message`;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className={cx("w-full min-w-0", width === "sm" ? "sm:w-44" : "sm:w-60")}>
          <Select
            id={id}
            aria-label={label}
            value={field.draft}
            onChange={(event) => {
              const next = event.target.value;
              field.change(next);
              const picked = options.find((option) => option.value === next);
              if (picked) onLive?.(picked.value);
            }}
            aria-invalid={problem ? true : undefined}
            aria-describedby={[describedBy, problem ? messageId : null].filter(Boolean).join(" ") || undefined}
            className={inputClass}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <SaveMark status={field.status} compact />
      </div>
      {problem ? (
        <div className={width === "sm" ? "max-w-56" : undefined}>
          <FieldMessage id={messageId} error={problem} />
        </div>
      ) : null}
    </div>
  );
}

/**
 * A name setting (a badge's, a prize's, an award's), in English or, `optional`, in Spanish:
 * blank then means "use the English one" (plan G8). Spaces are tidied as the API tidies them,
 * and it saves after a pause or on leaving the box.
 *
 * `label` names the box: shown above it with `showLabel` ("Spanish (optional)"), otherwise for
 * a screen reader only, where the table's column says what it is. `context` (which row) follows
 * the label for a screen reader only.
 */
export function TextSetting({
  path,
  value,
  label,
  context,
  showLabel = false,
  optional = false,
  words,
  onLive,
  autoFocus,
  className,
}: {
  path: string;
  value: string | null;
  label: string;
  context?: string;
  showLabel?: boolean;
  optional?: boolean;
  words?: ProblemWords;
  /** Hears every good value as it is typed, for what the page draws from it. */
  onLive?: (value: string | null) => void;
  /** For the name of a row the owner just added. */
  autoFocus?: boolean;
  className?: string;
}) {
  const id = useId();
  const parse = (raw: string) => parseName(raw, { optional });
  const field = useAutosave<string, string | null>({
    path,
    value,
    parse,
    format: (next) => next ?? "",
  });
  const problem = useProblemText({ words })(field.status);
  const messageId = `${id}-message`;
  return (
    <div className={cx("flex min-w-0 flex-col gap-1", className)}>
      <label htmlFor={id} className={showLabel ? "text-caption font-bold text-muted" : "sr-only"}>
        {label}
        {context ? <span className="sr-only">{`, ${context}`}</span> : null}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="text"
          autoComplete="off"
          maxLength={NAME_MAX}
          autoFocus={autoFocus}
          value={field.draft}
          onChange={(event) => {
            const next = event.target.value;
            field.change(next);
            const parsed = parse(next);
            if (parsed.ok) onLive?.(parsed.value);
          }}
          onBlur={field.flush}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? messageId : undefined}
          className={cx(inlineInputClass, "w-full min-w-36")}
        />
        <SaveMark status={field.status} compact />
      </div>
      {problem ? (
        <div className="max-w-60">
          <FieldMessage id={messageId} error={problem} />
        </div>
      ) : null}
    </div>
  );
}

/** A setting as a row of a rule card: what it is and what it does on the left, the control on
 *  the right; stacked on a phone. */
export function SettingRow({
  title,
  hint,
  hintId,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  /** For the control's aria-describedby. */
  hintId?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 sm:max-w-[58%]">
        <p className="font-bold">{title}</p>
        {hint ? (
          <p id={hintId} className="mt-0.5 text-caption text-muted">
            {hint}
          </p>
        ) : null}
      </div>
      <div className="min-w-0 sm:shrink-0">{children}</div>
    </div>
  );
}
