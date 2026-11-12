import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BadgesPanel, TiersPanel } from "@/components/badges/BadgesSettings";
import { LiveNote } from "@/components/coins/LiveNote";
import { portalMetadata } from "@/components/console/PortalPage";
import { Alert, PageHeader } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("badges");
}

/**
 * Badges & tiers (OP-18): the tier thresholds (Bronze fixed at 0, each one above the last)
 * with the people at each tier now, and every badge's name, rule, bonus coins and "gives a
 * spin" with the people who have it. The settings save as the owner types (plan §9).
 *
 * Read here on the server: the settings (the definitions), and GET /portal/badges-tiers for
 * the people counts, which may fail without taking the page with it: the counts then show as
 * unknown.
 */
export default async function BadgesPage() {
  const here = "/badges";
  const [t, tPage, tc, te] = await Promise.all([
    getTranslations("badges"),
    getTranslations("pages.badges"),
    getTranslations("coins"),
    getTranslations("errors"),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [settings, counts] = await Promise.all([
      api.GET("/api/v1/portal/settings").then(body),
      api
        .GET("/api/v1/portal/badges-tiers")
        .then(body)
        .catch(() => null),
    ]);
    return { settings, counts };
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

  const { settings, counts } = loaded.data;
  const { tiers, badges, spin } = settings.rules;

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />
      <LiveNote>{tc("live")}</LiveNote>
      {counts === null ? <Alert kind="warning">{t("countsError")}</Alert> : null}
      <TiersPanel tiers={tiers} counts={counts?.tiers ?? null} />
      <BadgesPanel
        badges={badges}
        counts={counts?.badges ?? null}
        spin={{ enabled: spin.enabled, on_badge: spin.on_badge, on_milestone: spin.on_milestone }}
      />
    </>
  );
}
