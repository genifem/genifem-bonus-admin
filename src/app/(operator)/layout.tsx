import { CirclePause, SearchX } from "lucide-react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { getTranslations } from "next-intl/server";

import { AuthFrame } from "@/components/AuthFrame";
import { buttonClass } from "@/components/ui";
import { hostName } from "@/lib/host";
import { loadOperator } from "@/lib/operator";

export async function generateMetadata(): Promise<Metadata> {
  const operator = await loadOperator();
  if (operator.state === "open") return {};
  const t = await getTranslations("operatorGate");
  const title = operator.state === "suspended" ? t("suspended.title") : t("missing.title");
  // A template with no %s: whatever page was asked for, the tab says what this page says.
  return { title: { default: title, template: title } };
}

/**
 * Every page on an operator's host (P7: acme.<base>): the owner portal, its sign-in and the
 * emailed links. A route group, so the URLs are what they were before there were subdomains.
 *
 * The host names the operator (src/proxy.ts), and here the API is asked about it (GET /meta,
 * lib/operator.ts): one nobody has created, or one the back office has suspended, gets a page
 * that says so in place of the portal, rather than a sign-in that cannot work. When the API
 * cannot be reached the pages carry on and say so themselves.
 */
export default async function OperatorLayout({ children }: { children: React.ReactNode }) {
  const operator = await loadOperator();
  if (operator.state === "missing" || operator.state === "suspended") {
    return <OperatorUnavailable kind={operator.state} />;
  }
  return children;
}

/** "Find your company" on the bare domain: this host without its first label. */
async function siteAddress(): Promise<string | null> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  const name = hostName(host);
  const dot = name.indexOf(".");
  if (dot < 0) return null;
  const port = /:(\d+)$/.exec(host.split(",")[0]!.trim())?.[1];
  const proto = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  return `${proto}://${name.slice(dot + 1)}${port ? `:${port}` : ""}/`;
}

async function OperatorUnavailable({ kind }: { kind: "missing" | "suspended" }) {
  const [t, tBrand, site] = await Promise.all([
    getTranslations("operatorGate"),
    getTranslations("brand"),
    siteAddress(),
  ]);
  const Icon = kind === "suspended" ? CirclePause : SearchX;
  return (
    <AuthFrame subtitle={tBrand("portal")}>
      <span
        aria-hidden="true"
        className="mb-4 flex size-11 items-center justify-center rounded-compact bg-warning-subtle text-warning-ink"
      >
        <Icon className="size-5" strokeWidth={2} />
      </span>
      <h1 className="text-2xl font-black">{t(`${kind}.title`)}</h1>
      <p className="mt-2 text-sm text-muted">{t(`${kind}.lead`)}</p>
      <p className="mt-3 text-sm text-muted">{t(`${kind}.help`)}</p>
      {kind === "missing" && site ? (
        <a href={site} className={buttonClass({ variant: "secondary", size: "console", className: "mt-5" })}>
          {t("findCompany")}
        </a>
      ) : null}
    </AuthFrame>
  );
}
