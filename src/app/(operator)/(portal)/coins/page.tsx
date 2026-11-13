import { ChevronRight, Coins, Gift, Send, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { CoinsSettings } from "@/components/coins/CoinsSettings";
import { LiveNote } from "@/components/coins/LiveNote";
import { portalMetadata } from "@/components/console/PortalPage";
import { Panel } from "@/components/recognition/Panel";
import { Alert, cx, PageHeader } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("coins");
}

/** The explainer's four steps (OP-13), each on its tint: the pairs hold 4.5:1. */
const STEPS: readonly { key: "allowance" | "give" | "earn" | "redeem"; icon: LucideIcon; tone: string }[] = [
  { key: "allowance", icon: Wallet, tone: "bg-lilac text-lilac-ink" },
  { key: "give", icon: Send, tone: "bg-red-soft text-red-action" },
  { key: "earn", icon: Coins, tone: "bg-butter text-gold-ink" },
  { key: "redeem", icon: Gift, tone: "bg-mint text-mint-ink" },
];

/**
 * Coins & limits (OP-13 to OP-15): how coins work, then each role's kudos allowance and
 * shout-out sizes with the worst case for crew, who can recognize whom, and the redemption
 * limits. The settings save as the owner types (plan §9) and apply in the app on its next
 * screen load.
 *
 * Read here on the server: the settings; the crew count for the worst case, from GET
 * /portal/team?role=crew's total (one row asked for, only the total used); and the open
 * stores, for the budget across all of them. Either of those two may fail without taking the
 * page with it.
 */
export default async function CoinsPage() {
  const here = "/coins";
  const [t, tPage, te] = await Promise.all([
    getTranslations("coins"),
    getTranslations("pages.coins"),
    getTranslations("errors"),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [settings, stores, crew] = await Promise.all([
      api.GET("/api/v1/portal/settings").then(body),
      api
        .GET("/api/v1/portal/stores")
        .then(body)
        .catch(() => null),
      api
        .GET("/api/v1/portal/team", { params: { query: { role: "crew", page: 1, page_size: 1 } } })
        .then(body)
        .catch(() => null),
    ]);
    return {
      settings,
      storeCount: stores ? stores.filter((store) => store.active).length : null,
      crewCount: crew ? crew.total : null,
    };
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

  const { settings, storeCount, crewCount } = loaded.data;
  const { allowance, amounts, scope, upward, redeem, coin_value } = settings.rules;

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />

      <LiveNote>{t("live")}</LiveNote>

      <Panel id="how-heading" title={t("how.heading")} icon={Coins}>
        {/* A row of four once the page has room for them, a column on a narrow one. */}
        <ol className="flex flex-col gap-1 @3xl/page:flex-row @3xl/page:items-stretch @3xl/page:gap-2">
          {STEPS.map((step, index) => (
            <li
              key={step.key}
              className="flex flex-col items-center gap-1 @3xl/page:flex-1 @3xl/page:flex-row @3xl/page:items-stretch @3xl/page:gap-2"
            >
              <div
                className={cx(
                  "flex w-full flex-1 items-center gap-2.5 rounded-xl p-3 @3xl/page:flex-col @3xl/page:items-start",
                  step.tone,
                )}
              >
                <step.icon aria-hidden="true" className="size-5.5 shrink-0" strokeWidth={2.2} />
                <span className="text-sm font-extrabold">{t(`how.${step.key}`)}</span>
              </div>
              {index < STEPS.length - 1 ? (
                <ChevronRight
                  aria-hidden="true"
                  className="size-4.5 shrink-0 rotate-90 self-center text-muted @3xl/page:rotate-0"
                  strokeWidth={2.4}
                />
              ) : null}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted">{t("how.note")}</p>
      </Panel>

      <CoinsSettings
        rules={{ allowance, amounts, scope, upward, redeem, coin_value }}
        crewCount={crewCount}
        storeCount={storeCount}
      />
    </>
  );
}
