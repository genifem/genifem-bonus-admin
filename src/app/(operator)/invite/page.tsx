import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { LoginForm } from "@/components/LoginForm";
import { operatorName } from "@/lib/operator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login.link.invite");
  // The token rides in the fragment, which no referrer carries; this keeps the page's own
  // address out of them too.
  return { title: t("title"), referrer: "no-referrer" };
}

/**
 * Where an owner's invite email lands (P7: `/invite#token=…`, sent when the back office creates
 * the operator or adds an owner): they choose a password and are signed in, or go on to set up
 * the second factor when it is on. The link works for 7 days and once.
 */
export default async function InvitePage() {
  const [tBrand, company] = await Promise.all([getTranslations("brand"), operatorName()]);
  return (
    <AuthFrame subtitle={tBrand("portal")} eyebrow={company}>
      <LoginForm next="/" link="invite" />
    </AuthFrame>
  );
}
