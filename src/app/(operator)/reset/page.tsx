import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { LoginForm } from "@/components/LoginForm";
import { operatorName } from "@/lib/operator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login.link.reset");
  return { title: t("title"), referrer: "no-referrer" };
}

/**
 * Where a "Forgot password?" email lands (P7: `/reset#token=…`, 1 hour, once): a new password,
 * which signs the owner in and ends their other sessions.
 */
export default async function ResetPage() {
  const [tBrand, company] = await Promise.all([getTranslations("brand"), operatorName()]);
  return (
    <AuthFrame subtitle={tBrand("portal")} eyebrow={company}>
      <LoginForm next="/" link="reset" />
    </AuthFrame>
  );
}
