"use client";

import { LOCALE_COOKIE, LOCALES, type Locale } from "@crewstars/i18n";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";

import { cx } from "@/components/ui";

/** Remembered for a year on this device; read by the server on the next request. */
function remember(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Switch UI language at any time (NF-02), as the prototype's EN / ES segmented pill.
 *
 * Buttons with aria-pressed rather than a select: two choices, both visible, one tap. Each
 * button is marked with its own language so a screen reader pronounces it correctly.
 */
export function LanguageSwitcher({ className }: { className?: string } = {}) {
  const t = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: Locale) {
    if (next === locale) return;
    remember(next);
    startTransition(() => router.refresh());
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      aria-busy={pending || undefined}
      className={cx(
        "flex shrink-0 rounded-full bg-surface p-[3px]",
        className,
      )}
    >
      {LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            lang={code}
            aria-pressed={active}
            title={t(`languages.${code}`)}
            disabled={pending}
            onClick={() => change(code)}
            className={cx(
              "relative h-8.5 min-w-8.5 rounded-full px-2.5 text-xs font-extrabold uppercase transition-colors duration-fast before:absolute before:inset-x-0 before:-inset-y-1.25 before:content-['']",
              active ? "bg-brand text-brand-fg" : "bg-transparent text-muted hover:text-foreground",
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
