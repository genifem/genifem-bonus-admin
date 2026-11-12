import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import type { PortalKey } from "./nav";

/** The browser tab's title for a portal page: its name on the rail. */
export async function portalMetadata(page: PortalKey): Promise<Metadata> {
  const t = await getTranslations("portal.nav");
  return { title: t(page) };
}
