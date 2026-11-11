import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { EmptyState, PageHeader } from "@/components/ui";

import { portalLink, type PortalKey } from "./nav";

/** The browser tab's title for a portal page: its name on the rail. */
export async function portalMetadata(page: PortalKey): Promise<Metadata> {
  const t = await getTranslations("portal.nav");
  return { title: t(page) };
}

/**
 * A portal page that is not built yet: the prototype's title and subtitle, and an empty state
 * naming the roadmap phase that brings it (plan §16). Each page replaces this with its real
 * content in that phase.
 */
export async function ComingSoonPage({ page, title }: { page: PortalKey; title?: string }) {
  const [t, tSoon] = await Promise.all([
    getTranslations("pages"),
    getTranslations("portal.comingSoon"),
  ]);
  const { phase } = portalLink(page);
  return (
    <>
      <PageHeader title={title ?? t(`${page}.title`)} lead={t(`${page}.lead`)} />
      <EmptyState title={tSoon("title", { phase })} lead={tSoon("lead")} />
    </>
  );
}
