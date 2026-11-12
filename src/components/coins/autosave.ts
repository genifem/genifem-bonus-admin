/**
 * Autosave for the rule pages (plan §9): each field saves itself, by its path in the settings
 * (`allowance.crew`, `amounts.gm.1`, `redeem.approval`), a moment after the owner stops typing.
 *
 * One FieldSaver per field. It never touches what is on screen: the owner's typing is theirs,
 * and the saver only says how the save is going (`SaveStatus`). In order:
 *
 * - An edit the field's own check refuses (out of the spec's "Allowed" range) is not sent; it
 *   says why at once. The API checks again whatever happens (it is the authority).
 * - A good edit waits for a pause (600 ms; 0 for a switch or a list), then is sent alone as a
 *   PATCH of that one path, so two owners editing different fields never overwrite each other.
 *   Each new edit restarts the wait, so a burst of typing is one save of the last value.
 * - Saves of one field go out one after another, never side by side, so the last value typed
 *   is the one the API keeps. A save that an edit has since overtaken says nothing when it
 *   comes back; the newer one speaks.
 * - `settings_busy` (another owner's save landed at the same moment, and the API ran out of
 *   retries) is tried once more after a short wait, then said.
 * - A 422 names the field when the API's check refused it (`details.fields[path]`, or the path
 *   above it: the three amounts are checked as one list).
 * - "Saved" shows for a short while, then goes quiet.
 *
 * Pure (no React), so it can be tested with fake timers; hooks/useAutosave puts it on a field.
 */

export type Parsed<T> = { ok: true; value: T } | { ok: false; problem: string };

export type SaveStatus =
  /** Nothing waiting and nothing to say. */
  | { kind: "idle" }
  /** A change is waiting for the owner to pause. */
  | { kind: "pending" }
  | { kind: "saving" }
  /** The last change landed. Shown for SAVED_FOR_MS, then idle. */
  | { kind: "saved" }
  /** The field's own check refused it; nothing was sent. `problem` names the rule broken. */
  | { kind: "invalid"; problem: string }
  /** The API refused it, or could not be reached. `message` is the API's word for this field
   *  when it named it (a 422), which the field says in its own language instead. */
  | { kind: "failed"; code: string; message: string | null };

/** As much of an ApiCallError as the saver needs. */
export interface SaveFailure {
  status: number;
  code: string;
  details?: unknown;
}

export interface FieldSaverOptions<T> {
  /** The setting's path, as PATCH /portal/settings takes it. */
  path: string;
  /** What the API holds now. */
  saved: T;
  /** Sends `{changes}`; rejects with an ApiCallError-like value. */
  send: (changes: Record<string, unknown>) => Promise<unknown>;
  onStatus: (status: SaveStatus) => void;
  delayMs?: number;
  busyRetryMs?: number;
  savedForMs?: number;
  equal?: (a: T, b: T) => boolean;
}

/** The pause after the last keystroke before a field saves (plan §9). */
export const SAVE_DELAY_MS = 600;
/** The wait before the one retry of a `settings_busy`. */
export const BUSY_RETRY_MS = 500;
/** How long "Saved" stays up. */
export const SAVED_FOR_MS = 2500;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The API's message for `path` in a 422's `details.fields`, or for the nearest path above it
 *  (`amounts.crew.1` is checked as `amounts.crew`). Null when it did not name this field. */
export function fieldMessage(details: unknown, path: string): string | null {
  const fields = isRecord(details) && isRecord(details.fields) ? details.fields : null;
  if (!fields) return null;
  let at = path;
  while (at) {
    const message = fields[at];
    if (typeof message === "string") return message;
    const dot = at.lastIndexOf(".");
    at = dot > 0 ? at.slice(0, dot) : "";
  }
  return null;
}

/** Whatever a send threw, as a failure with a code ("network" when it never got an answer). */
export function failureOf(err: unknown): SaveFailure {
  if (isRecord(err) || err instanceof Error) {
    const { status, code, details } = err as { status?: unknown; code?: unknown; details?: unknown };
    if (typeof status === "number" && typeof code === "string") return { status, code, details };
  }
  return { status: 0, code: "network" };
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class FieldSaver<T> {
  private readonly path: string;
  private send: (changes: Record<string, unknown>) => Promise<unknown>;
  private readonly onStatus: (status: SaveStatus) => void;
  private readonly delayMs: number;
  private readonly busyRetryMs: number;
  private readonly savedForMs: number;
  private readonly equal: (a: T, b: T) => boolean;

  /** What the API holds, as far as this field knows. */
  private saved: T;
  /** The newest good value typed; null after an edit the check refused. */
  private latest: { value: T } | null = null;
  /** Goes up with every edit: a save started before the latest edit is not the one to speak. */
  private generation = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private quiet: ReturnType<typeof setTimeout> | null = null;
  /** The saves of this field, one after another. */
  private queue: Promise<void> = Promise.resolve();
  private inflight = 0;
  private current: SaveStatus = { kind: "idle" };

  constructor(options: FieldSaverOptions<T>) {
    this.path = options.path;
    this.saved = options.saved;
    this.send = options.send;
    this.onStatus = options.onStatus;
    this.delayMs = options.delayMs ?? SAVE_DELAY_MS;
    this.busyRetryMs = options.busyRetryMs ?? BUSY_RETRY_MS;
    this.savedForMs = options.savedForMs ?? SAVED_FOR_MS;
    this.equal = options.equal ?? Object.is;
  }

  get status(): SaveStatus {
    return this.current;
  }

  /** Something is waiting to be sent, or on its way. */
  get busy(): boolean {
    return this.timer !== null || this.inflight > 0;
  }

  /** The owner changed the field. */
  edit(parsed: Parsed<T>): void {
    this.generation += 1;
    this.clearTimer();
    this.clearQuiet();
    if (!parsed.ok) {
      this.latest = null;
      this.set({ kind: "invalid", problem: parsed.problem });
      return;
    }
    this.latest = { value: parsed.value };
    // Back to what the API already has, with nothing on its way: there is nothing to save.
    if (this.inflight === 0 && this.equal(parsed.value, this.saved)) {
      this.set({ kind: "idle" });
      return;
    }
    this.set({ kind: "pending" });
    this.timer = setTimeout(() => this.fire(), this.delayMs);
  }

  /** Save now what is waiting for the pause (the field lost focus). */
  flush(): void {
    if (this.timer === null) return;
    this.clearTimer();
    this.fire();
  }

  /** The API's value changed under the field (the page was drawn again). Taken as the new
   *  baseline only while nothing of this field's is waiting or on its way. */
  rebase(value: T): void {
    if (!this.busy) this.saved = value;
  }

  /** The send to use from now on: the page's latest, which may read what the page last drew
   *  (a prize's type change sends what the prize lacks for it). */
  sendWith(send: (changes: Record<string, unknown>) => Promise<unknown>): void {
    this.send = send;
  }

  /** The field is going away: anything still waiting is sent now rather than lost. */
  dispose(): void {
    this.clearQuiet();
    this.flush();
  }

  private fire(): void {
    this.timer = null;
    const target = this.latest;
    if (!target) return;
    const generation = this.generation;
    this.inflight += 1;
    this.queue = this.queue.then(async () => {
      try {
        await this.save(target.value, generation);
      } finally {
        this.inflight -= 1;
      }
    });
  }

  private async save(value: T, generation: number): Promise<void> {
    const latest = () => generation === this.generation;
    if (this.equal(value, this.saved)) {
      // An earlier save of this field already left the API holding it.
      if (latest()) this.set({ kind: "idle" });
      return;
    }
    if (latest()) this.set({ kind: "saving" });
    let failure: SaveFailure | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await this.send({ [this.path]: value });
        failure = null;
        break;
      } catch (err) {
        failure = failureOf(err);
        // Busy is worth one more try - unless a newer edit will be sent anyway.
        if (failure.code !== "settings_busy" || attempt === 2 || !latest()) break;
        await wait(this.busyRetryMs);
      }
    }
    if (failure === null) {
      this.saved = value;
      if (latest()) {
        this.set({ kind: "saved" });
        this.quiet = setTimeout(() => {
          this.quiet = null;
          if (this.current.kind === "saved") this.set({ kind: "idle" });
        }, this.savedForMs);
      }
      return;
    }
    if (latest()) {
      this.set({
        kind: "failed",
        code: failure.code,
        message: failure.status === 422 ? fieldMessage(failure.details, this.path) : null,
      });
    }
  }

  private set(status: SaveStatus): void {
    this.current = status;
    this.onStatus(status);
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }

  private clearQuiet(): void {
    if (this.quiet !== null) clearTimeout(this.quiet);
    this.quiet = null;
  }
}
