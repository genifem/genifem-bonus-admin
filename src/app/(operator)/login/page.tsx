import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { LoginForm } from "@/components/LoginForm";
import { operatorName } from "@/lib/operator";
import { safeNext } from "@/lib/session-paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

/** The owner's way in, on their operator's host: the company's name over one white card with
 *  the form and, when it is on, the second step. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const signedOut = params.signedOut === "1";
  const [tBrand, company] = await Promise.all([getTranslations("brand"), operatorName()]);

  return (
    <AuthFrame subtitle={tBrand("portal")} eyebrow={company}>
      {/* The form draws the heading and its lead, which change with each sign-in step. */}
      <LoginForm next={next} signedOut={signedOut} />
    </AuthFrame>
  );
}
