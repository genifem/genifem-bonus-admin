import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { LiveNote } from "@/components/coins/LiveNote";
import { portalMetadata } from "@/components/console/PortalPage";
import { SpinSettings } from "@/components/spin/SpinSettings";
import { Alert, PageHeader } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("spin");
}

/**
 * Spin the wheel (OP-16, OP-17, plan D19): the switch that turns spins on or off for everyone,
 * when crew earn a spin and how many a month, the wheel as crew see it, and the prizes with
 * their odds and the average a spin pays. The settings save as the owner types (plan §9) and
 * apply in the app on its next screen load.
 *
 * Read here on the server: the settings, which hold the spin rules, the coin value for the
 * dollar estimate, and the badges (the Lucky Star prize gives the wheel's own badge).
 */
export default async function SpinPage() {
  const here = "/spin";
  const [t, tPage, tc, te] = await Promise.all([
    getTranslations("spin"),
    getTranslations("pages.spin"),
    getTranslations("coins"),
    getTranslations("errors"),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    return body(await api.GET("/api/v1/portal/settings"));
  });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={tPage("title")} lead={tPage("lead")} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {t("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { spin, coin_value, badges } = loaded.data.rules;

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />
      <LiveNote>{tc("live")}</LiveNote>
      <SpinSettings
        spin={spin}
        coinValue={coin_value}
        badges={badges.map(({ id, name, name_es, rule }) => ({ id, name, name_es, rule }))}
      />
    </>
  );
}
