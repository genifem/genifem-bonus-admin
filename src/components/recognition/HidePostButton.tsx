"use client";

import { EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";
import { apiPost, ApiCallError } from "@/lib/api";

/**
 * Hide a shout-out (NF-06, plan G3): it comes off the wall for everyone, the coins stay with
 * the person, and the API writes it to the audit log. Behind a confirmation, because nobody
 * can put it back from the portal.
 */
export function HidePostButton({ postId, recipient, coins }: { postId: string; recipient: string; coins: number }) {
  const t = useTranslations("recognition.feed");
  const tc = useTranslations("common");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function hide(): Promise<boolean> {
    setError(null);
    try {
      await apiPost<void>(`/portal/shoutouts/${postId}/hide`);
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      setError(te.has(code) ? te(code) : te("generic"));
      return false;
    }
    toast.show(t("hidden"));
    router.refresh();
    return true;
  }

  return (
    <>
      <Button
        variant="secondary"
        size="console"
        icon={<EyeOff aria-hidden="true" className="size-4" strokeWidth={2.2} />}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        {t("hide")}
        <VisuallyHidden>{` ${t("hideFor", { name: recipient })}`}</VisuallyHidden>
      </Button>
      {open ? (
        <ConfirmDialog
          title={t("hideTitle")}
          confirmLabel={t("hideConfirm")}
          cancelLabel={tc("cancel")}
          error={error}
          // The post leaves the list with its button, so focus goes to the page heading.
          focusAfter="heading"
          onConfirm={hide}
          onClose={() => setOpen(false)}
        >
          <p>{t("hideBody", { name: recipient, coins })}</p>
          <p className="text-muted">{t("hideAudit")}</p>
        </ConfirmDialog>
      ) : null}
    </>
  );
}
