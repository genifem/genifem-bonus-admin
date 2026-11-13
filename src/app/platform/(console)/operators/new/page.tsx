import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { NewOperatorForm } from "@/components/backoffice/NewOperatorForm";
import { NoAccess } from "@/components/backoffice/parts";
import { PageHeader } from "@/components/ui";
import { baseDomain } from "@/lib/host";
import { can, requirePlatformAdmin } from "@/lib/platform";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.newOperator");
  return { title: t("title") };
}

/**
 * New operator (P7): super admins only (operators.write). The form is NewOperatorForm; the
 * base domain comes from this deployment (lib/host.ts), so the address it previews is the
 * one the operator's portal will answer on.
 */
export default async function NewOperatorPage() {
  const admin = await requirePlatformAdmin();
  const t = await getTranslations("platform.newOperator");
  if (!can(admin, "operators.write")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="operators.write" />
      </>
    );
  }
  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <NewOperatorForm baseDomain={baseDomain()} />
    </>
  );
}
