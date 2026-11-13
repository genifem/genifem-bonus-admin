import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell");
  return {
    title: { default: t("subtitle"), template: `%s · ${t("titleSuffix")}` },
    robots: { index: false, follow: false },
  };
}

/**
 * The back office (admin.<base>, P7; src/proxy.ts serves it from here). The console's chrome
 * lives in the (console) group, so the sign-in and invite pages are not drawn inside a rail
 * they cannot use yet; this layer only names the surface and keeps it out of search engines.
 */
export default function PlatformLayout({ children }: LayoutProps<"/platform">) {
  return children;
}
