import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { EmailRequestForm } from "@/components/EmailRequestForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("findCompany");
  return { title: t("title") };
}

/**
 * "Find your company", on the bare domain (P7: stars.genifem.com, served from /site by
 * src/proxy.ts). Each operator's portal has its own address, so an owner who has lost theirs
 * gives their email, and the API emails the sign-in address of every company where it belongs
 * to an owner (POST /public/find-company). The page says the same whoever it is, and a word
 * for the crew, whose way in is the app.
 */
export default async function FindCompanyPage() {
  const [t, tBrand] = await Promise.all([getTranslations("findCompany"), getTranslations("brand")]);
  return (
    <AuthFrame subtitle={tBrand("portal")} variant="site">
      <EmailRequestForm
        endpoint="/public/find-company"
        labels={{
          title: t("title"),
          lead: t("lead"),
          email: t("email"),
          submit: t("submit"),
          sentTitle: t("sentTitle"),
          sent: t("sent"),
          again: t("again"),
        }}
      />
      <p className="mt-5 border-t border-border pt-4 text-caption text-muted">{t("crew")}</p>
    </AuthFrame>
  );
}
