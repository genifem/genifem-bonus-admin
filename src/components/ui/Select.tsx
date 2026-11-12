"use client";

import { Check, ChevronDown } from "lucide-react";
import {
  Children,
  Fragment,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import { placePanel } from "@/components/console/Popover";

import { cx } from "./cx";

interface Choice {
  value: string;
  label: string;
  disabled: boolean;
}

function textOf(node: React.ReactNode): string {
  return Children.toArray(node)
    .map((child) =>
      typeof child === "string" || typeof child === "number"
        ? String(child)
        : isValidElement(child)
          ? textOf((child.props as { children?: React.ReactNode }).children)
          : "",
    )
    .join("");
}

/** The choices a select is given as ordinary <option> children (arrays and fragments too). */
function choicesOf(children: React.ReactNode): Choice[] {
  const out: Choice[] = [];
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { value?: string | number; disabled?: boolean; children?: React.ReactNode };
    if (child.type === Fragment) out.push(...choicesOf(props.children));
    else if (child.type === "option") {
      out.push({
        value: String(props.value ?? textOf(props.children)),
        label: textOf(props.children),
        disabled: Boolean(props.disabled),
      });
    }
  });
  return out;
}

export interface SelectProps {
  id?: string;
  /** Submitted with its form, like a native select's name. */
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  /** Called with an event whose target and currentTarget carry value, name and form, so a
   *  handler written for a native select (event.target.value) works unchanged. */
  onChange?: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  disabled?: boolean;
  required?: boolean;
  /** The trigger's look: the classes a native select had (a field, a cell, a filter). */
  className?: string;
  /** Drawn before the chosen label (a calendar for a month, a pin for a store). */
  icon?: React.ReactNode;
  children: React.ReactNode;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "data-density"?: string;
}

/**
 * The dropdown everywhere in the app: a button that opens a styled list, in place of the
 * browser's own select menu, which could not be made to match the rest of the product.
 *
 * It takes the same children and props as a native select, so swapping one for the other is
 * the whole change. It is the WAI-ARIA select-only combobox: focus stays on the button, the
 * arrow keys move through the choices (Home and End to the ends), typing jumps to a choice
 * that starts with what was typed, Enter or Space picks, Escape closes. The list opens in the
 * browser's top layer, so a table's scroll box or a dialog never clips it. Its value goes
 * with a form through a field of the same name, and a required one blocks submitting while
 * empty, as the native one did.
 */
export function Select({
  id: idProp,
  name,
  value,
  defaultValue,
  onChange,
  disabled = false,
  required = false,
  className,
  icon,
  children,
  ...rest
}: SelectProps) {
  const choices = choicesOf(children);
  const controlled = value !== undefined;
  const [own, setOwn] = useState(String(defaultValue ?? choices[0]?.value ?? ""));
  const current = controlled ? String(value) : own;
  const selectedIndex = choices.findIndex((choice) => choice.value === current);
  const selected = selectedIndex >= 0 ? choices[selectedIndex] : undefined;

  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const base = useId();
  const id = idProp ?? `${base}-select`;
  const listId = `${base}-list`;
  const optionId = (index: number) => `${base}-option-${index}`;
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLUListElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });

  const enabled = (index: number) => index >= 0 && index < choices.length && !choices[index].disabled;
  const first = () => choices.findIndex((_, index) => enabled(index));
  const last = () => {
    for (let index = choices.length - 1; index >= 0; index--) if (enabled(index)) return index;
    return -1;
  };
  const next = (from: number, by: 1 | -1) => {
    for (let index = from + by; index >= 0 && index < choices.length; index += by) if (enabled(index)) return index;
    return from;
  };

  function openAt(index: number) {
    if (disabled) return;
    setActive(index >= 0 ? index : first());
    setOpen(true);
  }

  function choose(index: number) {
    const choice = choices[index];
    if (!choice || choice.disabled) return;
    setOpen(false);
    trigger.current?.focus();
    if (choice.value === current) return;
    if (!controlled) setOwn(choice.value);
    // The form field takes the value now, so a handler that submits the form sends it.
    if (field.current) field.current.value = choice.value;
    const target = {
      value: choice.value,
      name: name ?? "",
      form: field.current?.form ?? trigger.current?.closest("form") ?? null,
    };
    onChange?.({ target, currentTarget: target } as unknown as React.ChangeEvent<HTMLSelectElement>);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open || event.altKey) openAt(selectedIndex >= 0 ? selectedIndex : first());
        else setActive(next(active, event.key === "ArrowDown" ? 1 : -1));
        return;
      }
      case "Home":
      case "End":
        event.preventDefault();
        openAt(event.key === "Home" ? first() : last());
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (open) choose(active);
        else openAt(selectedIndex >= 0 ? selectedIndex : first());
        return;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
      default: {
        if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
        // Typing jumps to the next choice that starts with what was typed (half a second apart
        // starts again), like a native select.
        const now = Date.now();
        typed.current = {
          text: (now - typed.current.at > 500 ? "" : typed.current.text) + event.key.toLowerCase(),
          at: now,
        };
        const from = open ? active : selectedIndex;
        const order = [...choices.keys()].map((offset) => (from + 1 + offset) % choices.length);
        const match = order.find((index) => enabled(index) && choices[index].label.toLowerCase().startsWith(typed.current.text));
        if (match !== undefined) openAt(match);
      }
    }
  }

  /** Under (or above) the button and at least as wide; false once the button has scrolled
   *  out of sight, when there is nothing left to hang the list from. */
  function place(): boolean {
    const box = panel.current;
    const button = trigger.current;
    if (!box || !button) return true;
    const anchor = button.getBoundingClientRect();
    const viewport = { width: document.documentElement.clientWidth, height: document.documentElement.clientHeight };
    if (anchor.bottom < 0 || anchor.top > viewport.height) return false;
    Object.assign(box.style, {
      top: "0px",
      left: "0px",
      minWidth: `${anchor.width}px`,
      maxHeight: "",
      visibility: "hidden",
    });
    const origin = box.getBoundingClientRect();
    const spot = placePanel(anchor, { width: origin.width, height: Math.min(origin.height, 288) }, viewport, "down-start");
    Object.assign(box.style, {
      top: `${spot.top - origin.top}px`,
      left: `${spot.left - origin.left}px`,
      maxHeight: `${Math.min(spot.maxHeight ?? 288, 288)}px`,
      visibility: "",
    });
    return true;
  }

  // Placed before the browser paints.
  useLayoutEffect(() => {
    const box = panel.current;
    if (!box) return;
    if (!open) {
      if (box.matches(":popover-open")) box.hidePopover();
      return;
    }
    if (!box.matches(":popover-open")) box.showPopover();
    place();
  }, [open]);

  useEffect(() => {
    if (!open || active < 0) return;
    panel.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  useEffect(() => {
    if (!open) return;
    const inside = (target: EventTarget | null) =>
      target instanceof Node && (trigger.current?.contains(target) || panel.current?.contains(target));
    const onPointer = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false);
    };
    // The page or a dialog scrolling moves the button; the list follows it, and closes once
    // the button is out of sight. The list scrolling inside itself changes nothing.
    const follow = (event?: Event) => {
      if (event && panel.current?.contains(event.target as Node)) return;
      if (!place()) setOpen(false);
    };
    const onScroll = (event: Event) => follow(event);
    const onResize = () => follow();
    document.addEventListener("pointerdown", onPointer);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        id={id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? optionId(active) : undefined}
        aria-required={required || undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : first()))}
        onKeyDown={onKeyDown}
        {...rest}
        className={cx(
          "group inline-flex min-w-0 cursor-pointer items-center gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
      >
        {icon}
        <span
          title={selected?.label || undefined}
          className={cx("min-w-0 flex-1 truncate", (!selected || selected.value === "") && "text-muted")}
        >
          {selected?.label ?? ""}
        </span>
        <ChevronDown
          aria-hidden="true"
          className="ml-auto size-4 shrink-0 text-muted transition-transform duration-fast ease-standard group-aria-expanded:rotate-180"
          strokeWidth={1.8}
        />
      </button>
      {name !== undefined || required ? (
        <input
          ref={field}
          // A required choice is checked by the browser like a native select's; the field sits
          // out of sight and hands focus to the button when the browser points at it.
          type={required ? "text" : "hidden"}
          name={name}
          value={current}
          required={required}
          readOnly
          tabIndex={-1}
          aria-hidden="true"
          onFocus={() => trigger.current?.focus()}
          className={required ? "sr-only" : undefined}
        />
      ) : null}
      <ul
        ref={panel}
        id={listId}
        role="listbox"
        aria-labelledby={id}
        popover="manual"
        hidden={!open}
        className={cx(
          "fixed inset-auto top-0 left-0 m-0 max-w-[calc(100vw-16px)] overflow-y-auto overscroll-contain rounded-xl border border-border bg-surface-raised p-1.5 text-foreground shadow-popover",
          "transition-[opacity,translate] duration-fast ease-enter starting:-translate-y-1 starting:opacity-0",
        )}
      >
        {choices.map((choice, index) => {
          const isSelected = choice.value === current;
          return (
            <li
              key={`${choice.value}-${index}`}
              id={optionId(index)}
              data-index={index}
              role="option"
              aria-selected={isSelected}
              aria-disabled={choice.disabled || undefined}
              // Picking keeps focus on the button, as the pattern asks.
              onPointerDown={(event) => event.preventDefault()}
              onPointerMove={() => (choice.disabled ? undefined : setActive(index))}
              onClick={() => choose(index)}
              className={cx(
                // 44px rows: a finger picks one as surely as a mouse (NF-11).
                "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-sm",
                index === active && !choice.disabled && "bg-surface",
                isSelected ? "font-bold text-brand-strong" : "font-semibold",
                choice.disabled && "cursor-not-allowed text-muted",
              )}
            >
              <Check
                aria-hidden="true"
                className={cx("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")}
                strokeWidth={2.2}
              />
              <span className="min-w-0 truncate">{choice.label || " "}</span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
