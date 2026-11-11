import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { LoginForm } from "@/components/LoginForm";
import { safeNext } from "@/lib/session-paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("login");
  return { title: t("title") };
}

/** The owner's way in: the lockup and the language pill (Spanish is one tap away before
 *  signing in), then one white card with the form and, when it is on, the second step. */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : null);
  const signedOut = params.signedOut === "1";
  const tBrand = await getTranslations("brand");

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
          {/* The form draws the heading and its lead, which change with each sign-in step. */}
          <LoginForm next={next} signedOut={signedOut} />
        </div>
      </main>
    </div>
  );
}
