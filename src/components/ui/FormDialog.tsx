"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";

import { cx } from "./cx";
import { IconButton } from "./IconButton";
import { dialogMotion } from "./motion";

/**
 * Creation and editing in a dialog in the middle of the screen, instead of a form that shoves
 * everything below it down the page.
 *
 * Built on the native <dialog> element, which already does the parts that are easy to get
 * wrong: it traps focus, it closes on Escape, it makes the rest of the page inert, and it
 * restores focus to whatever opened it. A hand-rolled version would be more code and worse.
 *
 * On a phone it rises from the bottom as a sheet; from `sm` up it is centred, like the
 * confirmation dialogs. Its title and actions stay put while a long form scrolls between them.
 */
export function FormDialog({
  open,
  onClose,
  title,
  description,
  closeLabel,
  children,
  footer,
  className,
  busy = false,
  titleHidden = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** The accessible name of the close button, translated by the caller. */
  closeLabel: string;
  children: React.ReactNode;
  /** Actions live here so they stay put while the body scrolls. */
  footer?: React.ReactNode;
  className?: string;
  /** While a save is in flight the dialog cannot be dismissed (Escape and the close button do
   *  nothing), so a slow save is not mistaken for a cancelled one, as in ConfirmDialog. */
  busy?: boolean;
  /** For a body that opens with its own picture and big title (a welcome screen): the
   *  title is kept for screen readers but not drawn, and the close button floats over the top
   *  corner instead of sitting in a header bar. */
  titleHidden?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = description ? `${titleId}-description` : undefined;

  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    // showModal() is the only way to get the focus trap and the inert background; the `open`
    // attribute alone gives a non-modal dialog that does neither.
    if (open && !panel.open) panel.showModal();
    if (!open && panel.open) panel.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      // `close` covers Escape and the form-method=dialog path; both must tell the parent.
      onClose={onClose}
      onCancel={(event) => {
        if (busy) event.preventDefault();
      }}
      aria-busy={busy || undefined}
      // Fields inside a dialog are form fields, whatever surface opened it.
      data-density="form"
      className={cx(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-4xl border-0 bg-surface-raised p-0 text-foreground shadow-dialog",
        "sm:m-auto sm:max-h-[calc(100dvh-4rem)] sm:w-130 sm:max-w-[calc(100vw-2rem)] sm:rounded-4xl",
        // Rises a little as it fades in, and sinks back out; the scrim fades behind it.
        dialogMotion,
        "translate-y-3 open:translate-y-0 starting:open:translate-y-3",
        className,
      )}
    >
      {/* As tall as its form, up to the dialog's cap; past that the middle scrolls. */}
      <div className="flex max-h-[inherit] flex-col">
        <div
          className={cx(
            "flex items-start justify-between gap-3",
            titleHidden ? "absolute top-3 right-3 z-30" : "border-b border-border px-6 py-4",
          )}
        >
          <div className={titleHidden ? "sr-only" : "min-w-0 pt-1.5"}>
            <h2 id={titleId} className="break-words font-sans text-lg font-extrabold tracking-normal">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="mt-0.5 text-caption text-muted">
                {description}
              </p>
            ) : null}
          </div>
          <IconButton
            label={closeLabel}
            onClick={onClose}
            disabled={busy}
            variant="ghost"
            className={cx("shrink-0", titleHidden ? "bg-surface-raised/70 backdrop-blur-sm" : "-mr-2")}
          >
            {/* The glyph is decorative; the label is the accessible name. */}
            <X aria-hidden="true" className="size-5" strokeWidth={1.8} />
          </IconButton>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">{children}</div>

        {footer ? (
          <div className="flex flex-wrap justify-end gap-2.5 border-t border-border px-6 py-4">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}
