"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Alert } from "./Alert";
import { Button } from "./Button";
import { cx } from "./cx";
import { restoreFocus } from "./focus";
import { dialogMotion, afterExit } from "./motion";

/**
 * "Are you sure?" before something that cannot be taken back, such as deleting a path.
 *
 * The native <dialog> opened with showModal(): focus is trapped inside, the page behind is
 * inert, Escape cancels, and focus goes back to the button that opened it. Focus starts on
 * Cancel, the choice that does no harm. While the call is in flight it cannot be dismissed, so
 * a slow delete is not mistaken for a cancelled one; a refusal stays on screen in words.
 *
 * Mount it when it should open and unmount it from `onClose`.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  tone = "danger",
  error,
  confirmDisabled = false,
  focusAfter = "opener",
  onConfirm,
  onClose,
}: {
  title: string;
  /** What will happen, in words. Read out as the dialog's description. */
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  tone?: "danger" | "primary";
  /** Why the last try did not work. The dialog stays open to show it. */
  error?: React.ReactNode;
  /** Turns confirming off, e.g. once the API has said this cannot be done. */
  confirmDisabled?: boolean;
  /** Where focus goes once confirmed. `heading` (the page's h1) is for a delete, where the
   *  button that opened the dialog leaves with its row; a cancel always goes back to it. */
  focusAfter?: "opener" | "heading";
  /** Does the work. Resolve `false` (or throw) to keep the dialog open. */
  onConfirm: () => Promise<boolean | void>;
  /** After the dialog has closed, however it closed; `confirmed` when the work was done. */
  onClose: (confirmed: boolean) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const done = useRef(false);
  const opener = useRef<HTMLElement | null>(null);
  const id = useId();
  const [busy, setBusy] = useState(false);

  const focusCancel = () => ref.current?.querySelector<HTMLElement>("[data-cancel]")?.focus();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    focusCancel();
  }, []);

  // Once confirming is off, the focused confirm button would be a dead end.
  useEffect(() => {
    if (confirmDisabled) focusCancel();
  }, [confirmDisabled]);

  function close() {
    if (!busy) ref.current?.close();
  }

  async function confirm() {
    setBusy(true);
    let outcome: boolean | void = false;
    try {
      outcome = await onConfirm();
    } catch {
      outcome = false;
    }
    setBusy(false);
    if (outcome !== false) {
      done.current = true;
      ref.current?.close();
    }
  }

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={`${id}-title`}
      aria-describedby={`${id}-body`}
      aria-busy={busy || undefined}
      // React carries close and cancel up its own tree even where the browser does not bubble
      // them, so a dialog opened from inside a side panel would close the panel too.
      onClose={(event) => {
        event.stopPropagation();
        if (done.current && focusAfter === "heading") {
          const heading = document.querySelector<HTMLElement>("main h1");
          if (heading) {
            heading.tabIndex = -1;
            heading.focus();
          }
        } else {
          restoreFocus(opener.current, ref.current);
        }
        // Unmounting at once would cut the fade short, so the parent hears after it.
        const confirmed = done.current;
        afterExit(() => onClose(confirmed));
      }}
      onCancel={(event) => {
        event.stopPropagation();
        if (busy) event.preventDefault();
      }}
      onClick={(event) => {
        // A press on the scrim (the dialog box itself, outside the content) cancels.
        if (event.target === ref.current) close();
      }}
      // Left-aligned and regular weight even when opened from a right-aligned table cell.
      data-density="form"
      className={cx(
        "m-auto w-110 max-w-[calc(100vw-2rem)] rounded-4xl border-0 bg-surface-raised p-0 text-left font-normal text-foreground shadow-dialog",
        dialogMotion,
        "translate-y-2 open:translate-y-0 starting:open:translate-y-2",
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <h2 id={`${id}-title`} className="break-words font-sans text-lg font-extrabold tracking-normal">
          {title}
        </h2>
        <div id={`${id}-body`} className="flex flex-col gap-2 text-sm">
          {children}
        </div>
        {error ? <Alert>{error}</Alert> : null}
        <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap sm:justify-end">
          <Button data-cancel variant="secondary" size="console" type="button" onClick={close} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone}
            size="console"
            type="button"
            onClick={confirm}
            loading={busy}
            disabled={busy || confirmDisabled}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
