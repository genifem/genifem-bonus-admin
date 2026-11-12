"use client";

import { useEffect, useState } from "react";

import { apiPatch } from "@/lib/api";

import { FieldSaver, type Parsed, type SaveStatus } from "./autosave";

export interface Autosave<D> {
  /** What the control shows: the owner's own typing, never replaced while they change it. */
  draft: D;
  /** The owner changed the control. */
  change: (next: D) => void;
  /** Save now whatever is waiting (the control lost focus). */
  flush: () => void;
  status: SaveStatus;
}

/** One field path of the settings, as PATCH /portal/settings takes it. */
const send = (changes: Record<string, unknown>) => apiPatch<unknown>("/portal/settings", { changes });

/**
 * `useAutosave(path)` (plan §9): puts one setting on one control. The control shows `draft`
 * and calls `change` as the owner types; the field saves itself a moment after they stop
 * (autosave.ts has the rules), and `status` says how it went.
 *
 * `value` is what the API holds. When the page is drawn again with a different one (a refresh,
 * another owner's change), the control takes it - unless the owner is in the middle of
 * changing it, whose typing always wins.
 */
export function useAutosave<D, T>({
  path,
  value,
  parse,
  format,
  delayMs,
}: {
  path: string;
  value: T;
  /** Reads the control's value; a refusal is said at once and never sent. */
  parse: (draft: D) => Parsed<T>;
  /** How the control shows a value. */
  format: (value: T) => D;
  /** The pause before saving: typing waits (the default, 600 ms), a switch or a list need not. */
  delayMs?: number;
}): Autosave<D> {
  const [draft, setDraft] = useState<D>(() => format(value));
  const [status, setStatus] = useState<SaveStatus>({ kind: "idle" });
  const [saver] = useState(() => new FieldSaver<T>({ path, saved: value, send, onStatus: setStatus, delayMs }));
  const [seen, setSeen] = useState(value);

  if (!Object.is(value, seen)) {
    setSeen(value);
    if (status.kind === "idle" || status.kind === "saved") setDraft(format(value));
  }

  useEffect(() => {
    saver.rebase(value);
  }, [saver, value]);

  // Leaving the page sends what is still waiting rather than dropping it.
  useEffect(() => () => saver.dispose(), [saver]);

  return {
    draft,
    change: (next: D) => {
      setDraft(next);
      saver.edit(parse(next));
    },
    flush: () => saver.flush(),
    status,
  };
}
