import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

/**
 * The frame of every page outside the portal's rail: signing in, an emailed link, "Forgot
 * password?", "Find your company", the back office's sign-in, and the page an unknown or
 * suspended operator gets. The lockup and the language pill (Spanish is one tap away before
 * signing in), then one white card.
 *
 * `subtitle` names the surface under the lockup ("Owner portal", "Back office"); `eyebrow`,
 * over the card, names the company whose portal this is, so an owner can see they are in the
 * right place before typing a password.
 */
export async function AuthFrame({
  subtitle,
  eyebrow,
  children,
}: {
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  const tBrand = await getTranslations("brand");
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="mx-auto flex w-full max-w-110 items-center gap-3 px-5 pt-5">
        <div className="min-w-0 flex-1">
          <Lockup name={tBrand("name")} subtitle={subtitle} />
        </div>
        <LanguageSwitcher />
      </header>

      <main data-density="form" className="mx-auto flex w-full max-w-110 flex-1 flex-col justify-center px-5 pb-16 pt-8">
        {eyebrow ? <p className="eyebrow mb-2 truncate px-1">{eyebrow}</p> : null}
        <div className="rounded-2xl border border-border bg-surface-raised p-6">{children}</div>
      </main>
    </div>
  );
}
