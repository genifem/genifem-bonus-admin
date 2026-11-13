import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { PlatformSignIn } from "@/components/backoffice/PlatformSignIn";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.signIn.invite");
  // The token rides in the fragment; keep the page's own address out of referrers too.
  return { title: t("title"), referrer: "no-referrer" };
}

/**
 * Where a colleague's invite email lands (admin.<base>/invite#token=…, sent from Staff): they
 * choose a password, then set up the authenticator every back office account has (P7).
 */
export default async function PlatformInvitePage() {
  const t = await getTranslations("platform.shell");
  return (
    <AuthFrame subtitle={t("subtitle")} variant="backoffice">
      <PlatformSignIn next="/" invite />
    </AuthFrame>
  );
}
