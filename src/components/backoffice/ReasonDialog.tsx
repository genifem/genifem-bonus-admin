"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import {
  afterExit,
  Alert,
  Button,
  FormDialog,
  TextareaField,
  useToast,
  type ButtonVariant,
  type ToastTone,
} from "@/components/ui";
import { ApiCallError } from "@/lib/api";

/** The API's bounds on every back office reason (PlatformWriteIn). */
export const REASON_MIN = 3;
export const REASON_MAX = 500;

/**
 * Turns a failed call into words: the API's stable `code` through `errors.<code>`, a refused
 * permission naming what is missing, anything else as the generic line. The server's English
 * message is never shown.
 */
export function useApiErrorText(): (err: unknown) => string {
  const errors = useTranslations("errors");
  return (err) => {
    const code = err instanceof ApiCallError ? err.code : "generic";
    if (errors.has(code)) return errors(code);
    if (code === "http_422") return errors("validation_failed");
    if (code === "http_403") return errors("platform_permission_missing");
    return errors("generic");
  };
}

export interface ReasonDialogProps {
  title: string;
  /** One line under the title: what this acts on. */
  subtitle?: string;
  confirmLabel: string;
  /** `danger` for what takes something away (suspend), `primary` for the rest. */
  tone?: "primary" | "danger";
  /** Extra fields, drawn above the reason. Named inputs arrive in `onConfirm`'s FormData, and
   *  their own `required` / `type="email"` are checked before anything is sent. */
  children?: React.ReactNode;
  /** Drawn under the reason: what will happen, to read before confirming. */
  notice?: React.ReactNode;
  /** Does the work. Throw (an ApiCallError) to keep the dialog open with the error shown;
   *  resolve `false` to keep it open without one. */
  onConfirm: (reason: string, data: FormData) => Promise<unknown>;
  /** After the dialog has closed, however it closed. Unmount it here. */
  onClose: () => void;
}

/**
 * The one reason prompt every back office write goes through (P7). The API refuses a write
 * without a reason (3 to 500 characters) and keeps it with the audit event, so the prompt asks
 * for it every time, next to whatever else the action needs.
 *
 * The portal's FormDialog: a native modal <dialog> (focus trapped, the page behind inert,
 * Escape closes, focus goes back to the button that opened it), a sheet from the bottom on a
 * phone. Focus starts on the first field. While the call is in flight it cannot be dismissed,
 * so a slow save is not mistaken for a cancelled one; a refusal stays on screen in words, with
 * the form intact.
 *
 * Mount it to open it; it calls `onClose` once it has closed and its exit has played.
 */
export function ReasonDialog({
  title,
  subtitle,
  confirmLabel,
  tone = "primary",
  children,
  notice,
  onConfirm,
  onClose,
}: ReasonDialogProps) {
  const t = useTranslations("platform.reason");
  const tc = useTranslations("common");
  const errorText = useApiErrorText();
  const formId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(true);
  const [reason, setReason] = useState("");
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Start where the admin types: the first field, which is the reason when there is no other.
  useEffect(() => {
    form.current?.querySelector<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, button[role=combobox]")?.focus();
  }, []);

  // Closed: the parent hears once the fade has played, and unmounts it.
  useEffect(() => {
    if (!open) afterExit(onClose);
    // onClose is the parent's latest; closing happens once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const short = reason.trim().length < REASON_MIN;
  const reasonError = tried && short ? t("tooShort", { min: REASON_MIN }) : undefined;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // React carries submit up its own tree; a dialog opened inside another form stops here.
    event.stopPropagation();
    setTried(true);
    const target = event.currentTarget;
    if (short) {
      target.querySelector<HTMLElement>("textarea[name=reason]")?.focus();
      return;
    }
    if (!target.reportValidity()) return;
    setBusy(true);
    setError(null);
    try {
      const outcome = await onConfirm(reason.trim(), new FormData(target));
      setBusy(false);
      if (outcome !== false) setOpen(false);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  }

  const confirmVariant: ButtonVariant = tone === "danger" ? "dangerSolid" : "primary";

  return (
    <FormDialog
      open={open}
      onClose={() => setOpen(false)}
      title={title}
      description={subtitle}
      closeLabel={tc("close")}
      busy={busy}
      footer={
        <>
          <Button type="button" variant="secondary" size="form" onClick={() => setOpen(false)} disabled={busy}>
            {tc("cancel")}
          </Button>
          <Button type="submit" form={formId} variant={confirmVariant} size="form" loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {/* noValidate: the reason's own message comes first, in words beside it; the other
          fields are checked by the browser after that (reportValidity). */}
      <form id={formId} ref={form} onSubmit={(event) => void submit(event)} noValidate className="flex flex-col gap-4">
        {children}
        <TextareaField
          label={t("label")}
          name="reason"
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t("placeholder")}
          hint={reasonError ? undefined : t("hint", { min: REASON_MIN })}
          error={reasonError}
          maxLength={REASON_MAX}
          disabled={busy}
          required
        />
        {notice}
        {error ? <Alert kind="error">{error}</Alert> : null}
      </form>
    </FormDialog>
  );
}

/** What an action says when it is done: words for the toast, or words and a tone when it
 *  went only partly well (an owner added, but the invite email not sent). */
export type ActionOutcome = string | { message: string; tone: ToastTone } | void | false;

/**
 * A button that asks for a reason (and whatever `children` adds) before it acts, then shows
 * `done` as a toast and draws the page again from the server, so what the admin sees next is
 * what the API now holds. `onConfirm` may return a message to show instead of `done`, or
 * `false` to keep the dialog open.
 */
export function ReasonAction({
  label,
  ariaLabel,
  variant = "secondary",
  size = "console",
  icon,
  className,
  done,
  onConfirm,
  ...dialog
}: Omit<ReasonDialogProps, "onClose" | "onConfirm"> & {
  /** The button's words. */
  label: string;
  /** For a button whose words alone do not name it ("Resend invite" on every row). */
  ariaLabel?: string;
  variant?: ButtonVariant;
  size?: "xs" | "sm" | "console";
  icon?: React.ReactNode;
  className?: string;
  done?: string;
  onConfirm: (reason: string, data: FormData) => Promise<ActionOutcome>;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        icon={icon}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={className}
      >
        {label}
      </Button>
      {open ? (
        <ReasonDialog
          {...dialog}
          onConfirm={async (reason, data) => {
            const outcome = await onConfirm(reason, data);
            if (outcome === false) return false;
            if (typeof outcome === "object") toast.show(outcome.message, outcome.tone);
            else if (outcome || done) toast.show(outcome || done || "");
            router.refresh();
          }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
