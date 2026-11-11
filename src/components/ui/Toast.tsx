"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

import { cx } from "./cx";

/**
 * Confirmation that something saved, without a paragraph appearing mid-form and moving
 * everything under it.
 *
 * The region is a polite live region that exists from first render — announcing into a node
 * that is added at the same moment is unreliable, so the container is always there and only
 * its contents change.
 *
 * A toast is never the only record of anything: it says a save worked, and the saved state is
 * visible on the page behind it. Errors that need a decision belong in an Alert, which stays.
 */

export type ToastTone = "success" | "danger";

interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

interface ToastApi {
  show: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Four seconds is long enough to read a short sentence and short enough not to linger. */
const LINGER_MS = 4000;

const tones: Record<ToastTone, string> = {
  success: "border-success bg-success-subtle text-success-ink",
  danger: "border-danger bg-danger-subtle text-danger-ink",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { id, message, tone }]);
    setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), LINGER_MS);
  }, []);

  const api = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[calc(env(safe-area-inset-bottom)+5.5rem)] lg:pb-4"
      >
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className={cx(
              "pointer-events-auto w-full max-w-sm break-words rounded-lg border px-4 py-3 text-sm font-semibold shadow-popover transition-[opacity,translate] duration-base ease-enter starting:translate-y-2 starting:opacity-0",
              tones[toast.tone],
            )}
          >
            {toast.message}
          </p>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/**
 * Returns a no-op outside a provider rather than throwing: a missing toast must never be the
 * reason a save appears to fail. The save still happened and the page still shows it.
 */
export function useToast(): ToastApi {
  return useContext(ToastContext) ?? { show: () => {} };
}
