"use client";

import { Check, PackageCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { apiPost, ApiCallError } from "@/lib/api";

import { actionsFor, type RequestAction, type RequestStatus } from "./redemptions-query";

/** Codes that mean someone else got there first: the row is out of date, not broken. */
const SETTLED = new Set(["request_not_pending", "request_not_approved", "request_not_found"]);

/** The button just pressed leaves with its row (or turns into another), so focus goes to the
 *  table's heading, without scrolling, rather than to the top of the page. */
function focusRequests() {
  const heading = document.getElementById("requests-heading");
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

/**
 * What an owner can do to one reward request (OP-09): approve or decline one that waits (any
 * store's, plan G7 included), or mark an approved one collected (plan G5). Decline asks first,
 * because it gives the coins back and tells the person. Each one is written to the audit log by
 * the API (NF-09), and the page is drawn again after it.
 *
 * A request someone else decided in the meantime (409) says so and redraws the list, which
 * then shows where it stands.
 */
export function RequestActions({
  id,
  status,
  person,
  reward,
  coins,
}: {
  id: string;
  status: RequestStatus;
  /** The person's first name or name, for the words. */
  person: string;
  /** The reward's name in the reader's language. */
  reward: string;
  coins: number;
}) {
  const t = useTranslations("redemptions.actions");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<RequestAction | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [refreshing, startRefresh] = useTransition();

  const errorText = (err: unknown) => {
    const code = err instanceof ApiCallError ? err.code : "generic";
    return te.has(code) ? te(code) : te("generic");
  };
  const redraw = () => startRefresh(() => router.refresh());
  const values = { reward, name: person };

  async function act(action: "approve" | "collect") {
    if (busy) return;
    setBusy(action);
    try {
      await apiPost<unknown>(`/portal/reward-requests/${id}/${action}`);
      toast.show(action === "approve" ? t("approved", values) : t("collected", values));
      focusRequests();
    } catch (err) {
      toast.show(errorText(err), "danger");
    } finally {
      setBusy(null);
    }
    redraw();
  }

  async function decline(): Promise<boolean> {
    setError(null);
    try {
      await apiPost<unknown>(`/portal/reward-requests/${id}/decline`);
    } catch (err) {
      setError(errorText(err));
      if (err instanceof ApiCallError && SETTLED.has(err.code)) {
        setSettled(true);
        redraw();
      }
      return false;
    }
    toast.show(t("declined", { coins, name: person }));
    redraw();
    return true;
  }

  const actions = actionsFor(status);
  if (actions.length === 0) return null;
  const which = <VisuallyHidden>{` ${t("for", values)}`}</VisuallyHidden>;
  const off = busy !== null || refreshing;

  return (
    <div className="flex justify-end gap-2">
      {actions.map((action) =>
        action === "decline" ? (
          <Button
            key={action}
            variant="secondary"
            size="console"
            disabled={off}
            icon={<X aria-hidden="true" className="size-4" strokeWidth={2.4} />}
            onClick={() => {
              setError(null);
              setSettled(false);
              setConfirming(true);
            }}
          >
            {t("decline")}
            {which}
          </Button>
        ) : (
          <Button
            key={action}
            variant={action === "approve" ? "primary" : "secondary"}
            size="console"
            loading={busy === action}
            disabled={off}
            icon={
              action === "approve" ? (
                <Check aria-hidden="true" className="size-4" strokeWidth={2.4} />
              ) : (
                <PackageCheck aria-hidden="true" className="size-4" strokeWidth={2.2} />
              )
            }
            onClick={() => void act(action)}
          >
            {action === "approve" ? t("approve") : t("collect")}
            {which}
          </Button>
        ),
      )}
      {confirming ? (
        <ConfirmDialog
          title={t("declineTitle")}
          confirmLabel={t("declineConfirm")}
          cancelLabel={tc("cancel")}
          error={error}
          confirmDisabled={settled}
          // The row leaves the Waiting list with its buttons, so focus goes to the page heading.
          focusAfter="heading"
          onConfirm={decline}
          onClose={() => setConfirming(false)}
        >
          <p>{t("declineBody", { name: person, reward, coins })}</p>
          <p className="text-muted">{t("declineNotify")}</p>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
