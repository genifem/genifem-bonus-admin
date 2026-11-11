import { getFormatter, getTranslations } from "next-intl/server";

import { ComingSoonPage, portalMetadata } from "@/components/console/PortalPage";
import { loadOwner } from "@/lib/me";

export function generateMetadata() {
  return portalMetadata("overview");
}

/** Overview (P2): "Hi Grant, here's November", then KPI tiles, the by-store table and the
 *  feeds. For now, the greeting and the frame. */
export default async function OverviewPage() {
  const [owner, t, format] = await Promise.all([
    loadOwner(),
    getTranslations("pages.overview"),
    getFormatter(),
  ]);
  const month = format.dateTime(new Date(), { month: "long" });
  const title = owner ? t("title", { name: owner.firstName, month }) : t("titleNoName", { month });
  return <ComingSoonPage page="overview" title={title} />;
}
