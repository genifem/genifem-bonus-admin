import {
  DEFAULT_LOCALE,
  fromAcceptLanguage,
  isLocale,
  LOCALE_COOKIE,
  MESSAGES,
} from "@crewstars/i18n";
import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

/**
 * No locale in the URL: the language is a preference (NF-02), remembered in a cookie, falling
 * back to the browser's language.
 *
 * Dates are formatted in UTC for now. The month an owner sees is the operator's month (plan
 * D7), which the overview API returns from P2; until then only the month's name is shown.
 */
export default getRequestConfig(async () => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(chosen)
    ? chosen
    : (fromAcceptLanguage((await headers()).get("accept-language")) ?? DEFAULT_LOCALE);
  return { locale, messages: MESSAGES[locale], timeZone: "UTC" };
});
