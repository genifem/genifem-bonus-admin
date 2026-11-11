"use client";

import { useId, useRef, useState } from "react";

import { cx } from "./cx";
import { ringInside } from "./focus";

/**
 * A real ARIA tab widget, for panels that live in the same document.
 *
 * The sibling `Tabs` component is a set of links and should be preferred: it needs no
 * JavaScript and each tab renders on the server. This one exists for the one case links cannot
 * serve — the module player, where navigating away would tear down the video and lose the
 * viewer's place. Here the panels are genuinely on the page already, so the widget is honest.
 *
 * Keyboard follows the WAI-ARIA pattern: arrows move between tabs, Home and End jump to the
 * ends, and only the selected tab is in the tab order so Tab moves into the panel.
 */

export interface PanelItem {
  key: string;
  label: string;
  content: React.ReactNode;
}

export function TabPanels({
  items,
  label,
  className,
  selected: controlled,
  onSelect,
}: {
  items: readonly PanelItem[];
  label: string;
  className?: string;
  /** Pass both to drive the tab from outside (e.g. "Save and next"); omit to let it manage itself. */
  selected?: string;
  onSelect?: (key: string) => void;
}) {
  const base = useId();
  const [own, setOwn] = useState(items[0]?.key ?? "");
  const selected = controlled ?? own;
  const setSelected = (key: string) => {
    setOwn(key);
    onSelect?.(key);
  };
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (items.length === 0) return null;

  const focus = (key: string) => {
    setSelected(key);
    tabRefs.current[key]?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const index = items.findIndex((item) => item.key === selected);
    if (index < 0) return;
    const last = items.length - 1;
    const go =
      event.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : event.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? last
              : null;
    if (go === null) return;
    event.preventDefault();
    focus(items[go]!.key);
  };

  return (
    <div className={className}>
      <div
        role="tablist"
        aria-label={label}
        onKeyDown={onKeyDown}
        className="scrollbar-hidden relative flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-border)]"
      >
        {items.map((item) => {
          const active = item.key === selected;
          return (
            <button
              key={item.key}
              ref={(node) => {
                tabRefs.current[item.key] = node;
              }}
              type="button"
              role="tab"
              id={`${base}-tab-${item.key}`}
              aria-selected={active}
              aria-controls={`${base}-panel-${item.key}`}
              // Only the selected tab is reachable with Tab; arrows move within the list.
              tabIndex={active ? 0 : -1}
              onClick={() => setSelected(item.key)}
              className={cx(
                "flex min-h-11 shrink-0 items-center whitespace-nowrap border-b-2 px-4 font-medium transition-colors duration-fast",
                ringInside,
                active
                  ? "border-brand-ink text-brand-ink"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {items.map((item) => (
        <div
          key={item.key}
          role="tabpanel"
          id={`${base}-panel-${item.key}`}
          aria-labelledby={`${base}-tab-${item.key}`}
          hidden={item.key !== selected}
          // Focusable so a keyboard reaches a panel whose content is only text.
          tabIndex={0}
          className="py-4"
        >
          {item.content}
        </div>
      ))}
    </div>
  );
}
