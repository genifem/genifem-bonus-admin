import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "@/components/LoginForm";
import { Alert } from "@/components/ui";
import { safeNext } from "@/lib/session-paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

/** The owner's way in: the lockup and the language pill (Spanish is one tap away before
 *  signing in), then one white card with the form. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const signedOut = params.signedOut === "1";
  const [t, tBrand] = await Promise.all([getTranslations("login"), getTranslations("brand")]);

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="mx-auto flex w-full max-w-110 items-center gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <Lockup name={tBrand("name")} subtitle={tBrand("portal")} />
        </div>
        <LanguageSwitcher />
      </header>

      <main data-density="form" className="mx-auto flex w-full max-w-110 flex-1 flex-col justify-center px-5 pb-16 pt-8">
        <div className="rounded-2xl border border-border bg-surface-raised p-6">
          <h1 className="text-3xl font-black">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("lead")}</p>
          {signedOut ? (
            <Alert kind="info" className="mt-4">
              {t("signedOut")}
            </Alert>
          ) : null}
          <LoginForm next={next} />
        </div>
      </main>
    </div>
  );
}
