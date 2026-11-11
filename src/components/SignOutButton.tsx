"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTransition } from "react";

import { Button, type ButtonSize } from "@/components/ui";
import { apiPost } from "@/lib/api";
import { SIGN_IN } from "@/lib/session-paths";

/**
 * Ends the session (OP-21). The refresh token is revoked through the BFF's /auth/logout (the
 * proxy adds it; the browser never holds it), and then /api/session/end drops the cookies
 * whatever the API said, so a sign-out works even when the API cannot be reached.
 */
export function SignOutButton({ size = "console", className }: { size?: ButtonSize; className?: string }) {
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  async function signOut() {
    await apiPost("/auth/logout").catch(() => undefined);
    await fetch("/api/session/end", { method: "POST" }).catch(() => undefined);
    startTransition(() => {
      router.replace(SIGN_IN);
      router.refresh();
    });
  }

  return (
    <Button
      variant="secondary"
      size={size}
      className={className}
      icon={<LogOut aria-hidden="true" className="size-4" strokeWidth={2} />}
      loading={pending}
      onClick={() => void signOut()}
    >
      {t("signOut")}
    </Button>
  );
}
