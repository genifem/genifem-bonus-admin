"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState } from "react";

import { FieldMessage, Label } from "@/components/ui/Field";
import { inputClass } from "@/components/ui/controls";
import { cx } from "@/components/ui/cx";

/**
 * A password box with a button that shows what was typed, the way every sign-in step in the
 * portal draws one. The toggle has a fixed name ("Show password"); aria-pressed says whether
 * the password is showing, and it is a 44px target (NF-11).
 *
 * The order is the Field's: label, control, then one line for the hint or the error.
 */
export function PasswordInput({
  label,
  showLabel,
  hint,
  error,
  className,
  ...input
}: {
  label: string;
  /** The toggle's name, translated by the caller. */
  showLabel: string;
  hint?: string;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "id">) {
  const id = useId();
  const messageId = hint || error ? `${id}-message` : undefined;
  const [shown, setShown] = useState(false);
  return (
    <div className={cx("flex min-w-0 flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          {...input}
          type={shown ? "text" : "password"}
          aria-describedby={messageId}
          aria-invalid={error ? true : undefined}
          className={cx(inputClass, "pr-13")}
        />
        <button
          type="button"
          aria-label={showLabel}
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((now) => !now)}
          className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors duration-fast hover:bg-surface hover:text-foreground"
        >
          {shown ? (
            <EyeOff aria-hidden="true" className="size-5" strokeWidth={2} />
          ) : (
            <Eye aria-hidden="true" className="size-5" strokeWidth={2} />
          )}
        </button>
      </div>
      <FieldMessage id={messageId} hint={hint} error={error} />
    </div>
  );
}
