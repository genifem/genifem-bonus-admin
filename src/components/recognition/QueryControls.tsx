"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";

import { cx } from "@/components/ui/cx";
import { SelectField } from "@/components/ui/Field";
import { inputClass, labelClass } from "@/components/ui/controls";
import { withQuery } from "@/components/ui/query";

/**
 * Filters that apply as soon as they change, as the prototype's do: a select and a name search
 * whose state is the URL (the page reads it on the server). The URL is read when the change
 * is applied, not when the control was drawn, so a search typed while a store filter was
 * still loading keeps the store.
 *
 * Every change starts the list again from its first page.
 */

type Changes = Record<string, string | null>;

function useApplyQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const apply = (changes: Changes, mode: "push" | "replace", before?: () => void) => {
    const current = Object.fromEntries(new URLSearchParams(window.location.search));
    const href = `${pathname}${withQuery(current, { ...changes, offset: null })}`;
    startTransition(() => {
      before?.();
      if (mode === "push") router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    });
  };
  return { apply, pending };
}

export interface QueryOption {
  value: string;
  label: string;
}

/** A select for one query parameter; the empty value drops it ("All stores"). */
export function QuerySelect({
  label,
  param,
  value,
  options,
  also,
  className,
}: {
  label: string;
  param: string;
  value: string;
  options: readonly QueryOption[];
  /** Other parameters to change with it. */
  also?: Changes;
  className?: string;
}) {
  const { apply, pending } = useApplyQuery();
  // The new choice shows at once, while the page behind it loads.
  const [shown, setShown] = useOptimistic(value);
  return (
    <div className={cx("w-full min-w-0 sm:w-60", className)} aria-busy={pending || undefined}>
      <SelectField
        label={label}
        value={shown}
        onChange={(event) => {
          const next = event.target.value;
          apply({ ...also, [param]: next || null }, "push", () => setShown(next));
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
    </div>
  );
}

/** How long typing pauses before the list follows it. */
const SEARCH_DELAY_MS = 350;

/**
 * A name search: the list follows the typing once it pauses, and Enter applies it at once.
 * It is a real search form, so it is announced as one, and it works with the keyboard alone.
 */
export function QuerySearch({
  label,
  param = "q",
  value,
  placeholder,
  maxLength = 80,
  className,
}: {
  label: string;
  param?: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  className?: string;
}) {
  const id = useId();
  const { apply, pending } = useApplyQuery();
  const [text, setText] = useState(value);
  const [seen, setSeen] = useState(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The URL changed under the box (a "Clear the filters" link, the back button): show it,
  // unless it is only the trimmed form of what is being typed.
  if (value !== seen) {
    setSeen(value);
    if (value !== text.trim()) setText(value);
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const go = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next.trim() === value) return;
    apply({ [param]: next.trim() || null }, "replace");
  };

  return (
    <form
      role="search"
      aria-labelledby={`${id}-label`}
      className={cx("flex w-full min-w-0 flex-col gap-1.5 sm:w-60", className)}
      onSubmit={(event) => {
        event.preventDefault();
        go(text);
      }}
    >
      <label id={`${id}-label`} htmlFor={id} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted",
            pending && "animate-pulse",
          )}
          strokeWidth={2.2}
        />
        <input
          id={id}
          type="search"
          name={param}
          value={text}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          spellCheck={false}
          aria-busy={pending || undefined}
          className={cx(inputClass, "pl-9")}
          onChange={(event) => {
            const next = event.target.value;
            setText(next);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => go(next), SEARCH_DELAY_MS);
          }}
        />
      </div>
    </form>
  );
}
