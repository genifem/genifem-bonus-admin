import { getTranslations } from "next-intl/server";

import { PageHeader, Skeleton } from "@/components/ui";

/**
 * While the audit log loads: the page's own title, and the shape of a few entries. The grey
 * boxes are hidden from a screen reader, which hears that the log is loading instead.
 */
export default async function AuditLoading() {
  const [t, tPage] = await Promise.all([getTranslations("audit"), getTranslations("pages.audit")]);
  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />
      <div aria-busy="true" className="flex flex-col gap-4 rounded-2xl border border-border bg-surface-raised p-4.5">
        <p role="status" className="sr-only">
          {t("loading")}
        </p>
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-9 w-full max-w-xl rounded-full" />
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-4.5 w-full max-w-md" />
              <Skeleton className="h-3.5 w-32" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
