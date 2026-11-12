"use client";

import { Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { apiPost, ApiCallError } from "@/lib/api";

/**
 * "Announce winners now" (OP-20): pays this month's winners in every open store at once -
 * their prize coins, a trophy post on their store's wall and a notification - instead of
 * waiting for the month to end. It can be used once a month, so it asks first and says so;
 * once every store's month is announced it is off, and says when and by whom.
 *
 * `month` is the month's name in the reader's language; `done` is set once it was announced
 * (`when` and `by` as the page could tell them). The page is drawn again after.
 */
export function AnnounceWinners({
  month,
  done,
}: {
  month: string;
  done: { when: string | null; by: string | null } | null;
}) {
  const t = useTranslations("awards.announce");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const redraw = () => startRefresh(() => router.refresh());

  if (done) {
    const said =
      done.when && done.by
        ? t("doneBy", { month, when: done.when, by: done.by })
        : done.when
          ? t("doneWhen", { month, when: done.when })
          : t("done", { month });
    return (
      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <Button
          variant="secondary"
          size="console"
          disabled
          icon={<Trophy aria-hidden="true" className="size-4" strokeWidth={2.2} />}
        >
          {t("announced")}
        </Button>
        <p className="max-w-80 text-caption text-muted sm:text-right">{said}</p>
      </div>
    );
  }

  async function announce(): Promise<boolean> {
    setError(null);
    try {
      await apiPost<unknown>("/portal/awards/announce");
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      setError(te.has(code) ? te(code) : te("generic"));
      if (code === "awards_already_announced") {
        // Another owner got there first: the page will show theirs.
        setSettled(true);
        redraw();
      }
      return false;
    }
    toast.show(t("announcedToast", { month }));
    redraw();
    return true;
  }

  return (
    <>
      <Button
        variant="primary"
        size="console"
        disabled={refreshing}
        icon={<Trophy aria-hidden="true" className="size-4" strokeWidth={2.2} />}
        onClick={() => {
          setError(null);
          setSettled(false);
          setConfirming(true);
        }}
      >
        {t("button", { month })}
      </Button>
      {confirming ? (
        <ConfirmDialog
          title={t("title", { month })}
          confirmLabel={t("confirm")}
          cancelLabel={tc("cancel")}
          tone="primary"
          error={error}
          confirmDisabled={settled}
          onConfirm={announce}
          onClose={() => setConfirming(false)}
        >
          <p>{t("body")}</p>
          <p className="font-bold">{t("once")}</p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
