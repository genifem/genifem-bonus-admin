"use client";

import { useId } from "react";

import { cx } from "./cx";

/** The prototype's switch: 46x26, action red when on. A real `role="switch"` button, so it is reachable
 *  and announced as on or off; the whole row is its label, so pressing the words flips it too
 *  (the switch alone is a small target). The off track is border-strong, which holds 3:1. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  name,
  hideLabel = false,
  className,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  /** When set, a hidden input carries the value so the toggle works inside a plain <form>. */
  name?: string;
  hideLabel?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <label
      className={cx(
        "flex min-h-11 items-center gap-3.5",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
        className,
      )}
    >
      <span className={cx("min-w-0 flex-1", hideLabel && "sr-only")}>
        <span id={`${id}-label`} className="block text-sm font-bold">
          {label}
        </span>
        {description ? (
          <span id={`${id}-desc`} className="mt-0.5 block text-caption text-muted">
            {description}
          </span>
        ) : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={cx(
          "relative flex h-6.5 w-11.5 shrink-0 items-center rounded-full p-0.5",
          "transition-colors duration-fast ease-standard disabled:opacity-50",
          checked ? "bg-brand" : "bg-border-strong",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "block size-5.5 rounded-full bg-white shadow-thumb transition-transform duration-base ease-standard",
            checked && "translate-x-5",
          )}
        />
      </button>
      {name ? <input type="hidden" name={name} value={checked ? "true" : "false"} /> : null}
    </label>
  );
}
