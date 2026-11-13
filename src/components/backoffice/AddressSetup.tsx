import { ExternalLink } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { subdomainSetup } from "@/lib/host";

import { CopyButton } from "./CopyButton";

/**
 * What putting a new operator's portal online takes, by hand (P7): there is no wildcard domain,
 * so each operator's host is a CNAME at the DNS host (Hostinger, for genifem.com) and a domain
 * in the portal's Vercel project. The names are worked out from the base domain
 * (lib/host.ts subdomainSetup); the CNAME's target is the one Vercel shows for the domain.
 *
 * Locally (`localhost`) there is nothing to do: *.localhost reaches this machine on its own.
 */
export async function AddressSetup({ slug, portalUrl }: { slug: string; portalUrl: string }) {
  const t = await getTranslations("platform.operator.address");
  const setup = subdomainSetup(slug);
  const code = "rounded-sm bg-surface px-1.5 py-0.5 font-mono text-caption font-bold break-all";
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          translate="no"
          className="inline-flex min-h-11 min-w-0 items-center gap-1.5 break-all font-extrabold text-brand-ink underline-offset-2 hover:underline"
        >
          {portalUrl}
          <ExternalLink aria-hidden="true" className="size-4 shrink-0" strokeWidth={2} />
          <span className="sr-only">{t("newTab")}</span>
        </a>
        <CopyButton text={portalUrl} label={t("copy")} copied={t("copied")} />
      </div>
      {setup ? (
        <ol className="flex list-decimal flex-col gap-2.5 pl-5">
          <li>
            {t.rich("dns", {
              zone: setup.zone,
              record: setup.record,
              b: (chunks) => <b className="font-extrabold">{chunks}</b>,
              code: (chunks) => (
                <code translate="no" className={code}>
                  {chunks}
                </code>
              ),
            })}
          </li>
          <li>
            {t.rich("vercel", {
              host: setup.host,
              b: (chunks) => <b className="font-extrabold">{chunks}</b>,
              code: (chunks) => (
                <code translate="no" className={code}>
                  {chunks}
                </code>
              ),
            })}
          </li>
          <li>{t("wait")}</li>
        </ol>
      ) : (
        <p className="text-muted">{t("local")}</p>
      )}
    </div>
  );
}
