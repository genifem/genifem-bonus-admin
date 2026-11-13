import { ChevronRight, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { RewardsTable } from "@/components/rewards/RewardsTable";
import { Alert, PageHeader } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("rewards");
}

/**
 * Rewards (OP-10 to OP-12): every reward, shown in the app or not, with what it costs, what
 * unlocks it and its monthly limit; add, edit, hide or delete one; the note on taxable cash and
 * gift cards; and the limits that apply to every reward, which are set on Coins & limits.
 *
 * Read here on the server: the rewards, and the settings for the tiers and badges a reward can
 * be unlocked by, the coin value and the limits. The table and its dialog are the client part.
 */
export default async function RewardsPage() {
  const here = "/rewards";
  const [t, tPage, te, locale] = await Promise.all([
    getTranslations("rewards"),
    getTranslations("pages.rewards"),
    getTranslations("errors"),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [rewards, settings] = await Promise.all([
      api.GET("/api/v1/portal/rewards").then(body),
      api.GET("/api/v1/portal/settings").then(body),
    ]);
    return { rewards, settings };
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

  const { rewards, settings } = loaded.data;
  const { rules } = settings;
  const count = (value: number) => formatCount(value, locale);

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />

      <RewardsTable rewards={rewards} tiers={rules.tiers} badges={rules.badges} coinValue={rules.coin_value} />

      <Panel id="limits-heading" title={t("limits.heading")} icon={SlidersHorizontal}>
        <p className="text-sm tabular-nums">
          {t.rich("limits.body", {
            coins: count(rules.redeem.max_coins),
            rewards: rules.redeem.max_rewards,
            budget: count(rules.redeem.store_budget),
            b: (chunks) => <b className="font-black">{chunks}</b>,
          })}{" "}
          {rules.redeem.approval ? t("limits.approvalOn") : t("limits.approvalOff")}
        </p>
        <Link
          href="/coins"
          className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
        >
          {t("limits.change")}
          <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.4} />
        </Link>
      </Panel>
    </>
  );
}
