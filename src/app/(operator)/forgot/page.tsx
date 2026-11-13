import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { EmailRequestForm } from "@/components/EmailRequestForm";
import { operatorName } from "@/lib/operator";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("forgot");
  return { title: t("title") };
}

/**
 * "Forgot password?" from the sign-in page (P7): an email address, and a reset link
 * (`/reset#token=…`, 1 hour) emailed when it belongs to an owner of this operator. The page
 * says the same either way.
 */
export default async function ForgotPage() {
  const [t, tBrand, company] = await Promise.all([
    getTranslations("forgot"),
    getTranslations("brand"),
    operatorName(),
  ]);
  return (
    <AuthFrame subtitle={tBrand("portal")} eyebrow={company}>
      <EmailRequestForm
        endpoint="/auth/owner/forgot"
        labels={{
          title: t("title"),
          lead: t("lead"),
          email: t("email"),
          submit: t("submit"),
          sentTitle: t("sentTitle"),
          sent: company ? t("sent", { company }) : t("sentNoName"),
          again: t("again"),
        }}
        footer={
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
          >
            {t("back")}
          </Link>
        }
      />
    </AuthFrame>
  );
}
