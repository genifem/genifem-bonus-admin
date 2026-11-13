import { Clock } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { PlatformSignIn } from "@/components/backoffice/PlatformSignIn";
import { Alert, readString } from "@/components/ui";
import { safeNext } from "@/lib/session-paths";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.signIn");
  return { title: t("title") };
}

/**
 * Crew Stars staff sign in here (admin.<base>/login); owners never see this host. When the
 * back office signed someone out for inactivity (401 session_idle, or the page's own idle
 * timer) they land here with `?signedOut=idle`, and the page says so, so it does not look like
 * a fault.
 */
export default async function PlatformLoginPage({ searchParams }: PageProps<"/platform/login">) {
  const query = await searchParams;
  const [t, tShell] = await Promise.all([getTranslations("platform.signIn"), getTranslations("platform.shell")]);
  const signedOut = readString(query, "signedOut");
  const next = safeNext(readString(query, "next"));
  const notice =
    signedOut === "idle" ? (
      <p
        role="status"
        className="flex items-start gap-2.5 rounded-lg border border-warning bg-warning-subtle p-3 text-sm font-semibold text-warning-ink"
      >
        <Clock aria-hidden="true" className="mt-px size-4.5 shrink-0" strokeWidth={2} />
        {t("idle")}
      </p>
    ) : signedOut ? (
      <Alert kind="info">{t("signedOut")}</Alert>
    ) : null;

  return (
    <AuthFrame subtitle={tShell("subtitle")}>
      <PlatformSignIn next={next} notice={notice} />
    </AuthFrame>
  );
}
