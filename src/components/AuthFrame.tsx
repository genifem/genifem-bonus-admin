import { Check } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Lockup, StarMark } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export type AuthVariant = "owner" | "backoffice" | "site";

/**
 * The frame of every page outside the portal's rail: signing in, an emailed link, "Forgot
 * password?", "Find your company", the back office's sign-in, and the page an unknown or
 * suspended operator gets.
 *
 * On a phone: the lockup and the language pill (Spanish is one tap away before signing in),
 * then one white card. From 1024px it is a desk page rather than a phone one: a brand panel
 * on the left saying what this surface is for (`variant`: the owner portal, the back office
 * or "Find your company"), and the card on the right, centred in the space that is left.
 * White on the brand red is 5.4:1 (plan D17); the panel's stars are decoration only, forced
 * white over StarMark's own red.
 *
 * `subtitle` names the surface under the lockup ("Owner portal", "Back office"); `eyebrow`,
 * over the card, names the company whose portal this is, so an owner can see they are in the
 * right place before typing a password.
 */
export async function AuthFrame({
  subtitle,
  eyebrow,
  variant = "owner",
  children,
}: {
  subtitle?: string;
  eyebrow?: string;
  variant?: AuthVariant;
  children: React.ReactNode;
}) {
  const [tBrand, tPanel] = await Promise.all([
    getTranslations("brand"),
    getTranslations("authPanel"),
  ]);
  const points = [tPanel(`${variant}.point1`), tPanel(`${variant}.point2`), tPanel(`${variant}.point3`)];

  return (
    <div className="flex min-h-dvh flex-1 bg-background">
      <aside className="relative hidden w-[44%] max-w-180 shrink-0 flex-col justify-between overflow-hidden bg-brand px-12 py-10 text-brand-fg lg:flex xl:px-16 xl:py-12">
        {/* Decoration: a few large, faint stars behind the words. */}
        <StarMark className="pointer-events-none absolute -right-24 -top-20 size-96 text-brand-fg! opacity-10" />
        <StarMark className="pointer-events-none absolute -bottom-28 -left-20 size-80 text-brand-fg! opacity-[0.07]" />

        <div className="relative flex items-center gap-2.5">
          <StarMark className="size-8 text-brand-fg!" />
          <span className="flex flex-col">
            <span className="text-xl font-black leading-tight tracking-tight">{tBrand("name")}</span>
            {subtitle ? <span className="text-xs font-bold leading-tight">{subtitle}</span> : null}
          </span>
        </div>

        <div className="relative max-w-140">
          <h2 className="text-balance text-4xl font-black leading-tight tracking-tight xl:text-5xl">
            {tPanel(`${variant}.title`)}
          </h2>
          <p className="mt-4 text-pretty text-lg leading-relaxed">{tPanel(`${variant}.lead`)}</p>
          <ul className="mt-8 flex flex-col gap-3.5">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-base font-bold">
                <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-brand-fg text-brand-ink">
                  <Check className="size-4" strokeWidth={3} />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm font-bold">{tPanel("footer")}</p>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mx-auto flex w-full max-w-110 items-center gap-3 px-5 pt-5 lg:mx-0 lg:max-w-none lg:justify-end lg:px-10 lg:pt-8">
          {/* The brand panel carries the lockup on a desk. */}
          <div className="min-w-0 flex-1 lg:hidden">
            <Lockup name={tBrand("name")} subtitle={subtitle} />
          </div>
          <LanguageSwitcher />
        </header>

        <main
          data-density="form"
          className="mx-auto flex w-full max-w-110 flex-1 flex-col justify-center px-5 pb-16 pt-8 lg:max-w-120 lg:px-8 lg:pb-24"
        >
          {eyebrow ? <p className="eyebrow mb-2 truncate px-1">{eyebrow}</p> : null}
          <div className="rounded-2xl border border-border bg-surface-raised p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
