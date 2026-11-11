"use client";

import { CircleAlert } from "lucide-react";
import { useId } from "react";

import { inputClass, labelClass, textareaClass, type Density } from "./controls";
import { cx } from "./cx";
import { Select, type SelectProps } from "./Select";

/** The accessibility wiring every form control needs, in one place: a real label bound by id,
 *  the hint and the error both reachable through aria-describedby, aria-invalid when it is
 *  wrong, and a target at least 44px tall (NF-11).
 *
 *  Every text field in the product draws the same box: the height, padding, text size and
 *  radius of the density it sits in (a shell sets `data-density`; forms are the default), one
 *  `control-border` edge that holds 3:1 against the page (WCAG 1.4.11), and one focus edge
 *  (ui/focus.ts). The order is always label, control, then one message line: the hint, or the
 *  error in its place, so the control never moves when either appears. */

interface Labelled {
  label: string;
  hint?: string;
  error?: string;
  /** Keeps one line under the control even when there is no message, for a form whose errors
   *  come and go as you type, so nothing below it jumps. */
  reserveMessage?: boolean;
  /** Overrides the density the control would take from the surface it sits in. */
  density?: Density;
}

function useFieldIds(hint?: string, error?: string) {
  const id = useId();
  const messageId = hint || error ? `${id}-message` : undefined;
  return { id, messageId };
}

export function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className={labelClass}>
      {children}
    </label>
  );
}

/** The line under a control: the hint, or the error in its place. */
export function FieldMessage({
  id,
  hint,
  error,
  reserve = false,
}: {
  id?: string;
  hint?: string;
  error?: string;
  reserve?: boolean;
}) {
  if (!hint && !error) return reserve ? <p aria-hidden="true" className="min-h-5" /> : null;
  if (error) {
    return (
      <p id={id} className="flex min-h-5 items-start gap-1.5 text-caption font-semibold text-danger-ink">
        <CircleAlert aria-hidden="true" className="mt-px size-4 shrink-0" strokeWidth={2} />
        <span className="min-w-0 break-words">{error}</span>
      </p>
    );
  }
  return (
    <p id={id} className={cx("text-caption text-muted", reserve && "min-h-5")}>
      {hint}
    </p>
  );
}

export function Field({
  label,
  hint,
  error,
  reserveMessage,
  density,
  className,
  ...input
}: Labelled & React.InputHTMLAttributes<HTMLInputElement>) {
  const { id, messageId } = useFieldIds(hint, error);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        data-density={density}
        {...input}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        className={cx(inputClass, className)}
      />
      <FieldMessage id={messageId} hint={hint} error={error} reserve={reserveMessage} />
    </div>
  );
}

export function TextareaField({
  label,
  hint,
  error,
  reserveMessage,
  density,
  className,
  ...textarea
}: Labelled & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, messageId } = useFieldIds(hint, error);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id}
        data-density={density}
        {...textarea}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        className={cx(textareaClass, className)}
      />
      <FieldMessage id={messageId} hint={hint} error={error} reserve={reserveMessage} />
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  reserveMessage,
  density,
  className,
  children,
  ...select
}: Labelled & Omit<SelectProps, "id" | "aria-describedby" | "aria-invalid" | "data-density">) {
  const { id, messageId } = useFieldIds(hint, error);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        data-density={density}
        {...select}
        aria-describedby={messageId}
        aria-invalid={error ? true : undefined}
        className={cx(inputClass, className)}
      >
        {children}
      </Select>
      <FieldMessage id={messageId} hint={hint} error={error} reserve={reserveMessage} />
    </div>
  );
}

/** The label is the target as well as the name, so the whole row is 44px of tappable area. */
export function CheckboxField({
  label,
  hint,
  error,
  className,
  ...input
}: Omit<Labelled, "density" | "reserveMessage"> & React.InputHTMLAttributes<HTMLInputElement>) {
  const { id, messageId } = useFieldIds(hint, error);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex min-h-11 items-center gap-3">
        <input
          id={id}
          type="checkbox"
          {...input}
          aria-describedby={messageId}
          aria-invalid={error ? true : undefined}
          className={cx("size-5 shrink-0 cursor-pointer accent-brand disabled:cursor-not-allowed", className)}
        />
        <label htmlFor={id} className="min-w-0 cursor-pointer text-sm font-semibold">
          {label}
        </label>
      </div>
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
