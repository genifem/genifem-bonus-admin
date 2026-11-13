import { ChevronLeft, ChevronRight, ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { actionKey, AuditEvents } from "@/components/backoffice/AuditEvents";
import {
  actionHref,
  AUDIT_ACTIONS,
  auditApiQuery,
  auditState,
  newestHref,
  olderHref,
} from "@/components/backoffice/audit-query";
import { NoAccess } from "@/components/backoffice/parts";
import { Panel } from "@/components/recognition/Panel";
import {
  Alert,
  buttonClass,
  EmptyState,
  FilterBar,
  FilterChips,
  PageHeader,
  SelectField,
  withQuery,
  type Query,
} from "@/components/ui";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  return { title: t("audit") };
}

/**
 * The back office's audit log (P7), from GET /platform/audit: every write an admin made -
 * operators created, edited, suspended; owners invited, reset, suspended; colleagues invited
 * and managed - with the reason each one gave, and sign-ins, lockouts and refused attempts.
 * Newest first, filtered by operator, by admin and by kind of action, all in the URL, and paged
 * with the API's cursor ("Older"). The operator and admin lists come from Operators and Staff
 * when the role reads them; without, those filters are not offered.
 */
export default async function PlatformAuditPage({ searchParams }: PageProps<"/platform/audit">) {
  const query = (await searchParams) as Query;
  const admin = await requirePlatformAdmin();
  const [t, tOverview, te] = await Promise.all([
    getTranslations("platform.audit"),
    getTranslations("platform.overview"),
    getTranslations("errors"),
  ]);
  const state = auditState(query);
  const here = `/audit${withQuery(query, {})}`;
  const now = new Date();

  if (!can(admin, "audit.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="audit.read" />
      </>
    );
  }

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [page, operators, staff] = await Promise.all([
      api.GET("/api/v1/platform/audit", { params: { query: auditApiQuery(state) } }).then(body),
      can(admin, "operators.read")
        ? api
            .GET("/api/v1/platform/operators")
            .then(body)
            .catch(() => null)
        : null,
      can(admin, "staff.read")
        ? api
            .GET("/api/v1/platform/staff")
            .then(body)
            .catch(() => null)
        : null,
    ]);
    return { page, operators: operators?.items ?? null, staff: staff?.items ?? null };
  });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={t("title")} lead={t("lead")} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {tOverview("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { page, operators, staff } = loaded.data;
  const filtered = Boolean(state.operator || state.actor || state.action);

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />

      {operators || staff ? (
        <FilterBar
          action="/audit"
          query={query}
          carry={["action"]}
          label={t("filters.label")}
          submitLabel={t("filters.apply")}
          className="rounded-2xl border border-border bg-surface-raised p-4.5"
        >
          {operators ? (
            <div className="w-full sm:w-64">
              <SelectField label={t("filters.operator")} name="operator" defaultValue={state.operator ?? ""}>
                <option value="">{t("filters.anyOperator")}</option>
                {operators.map((operator) => (
                  <option key={operator.id} value={operator.id}>
                    {operator.name}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
          {staff ? (
            <div className="w-full sm:w-64">
              <SelectField label={t("filters.actor")} name="actor" defaultValue={state.actor ?? ""}>
                <option value="">{t("filters.anyActor")}</option>
                {staff.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </SelectField>
            </div>
          ) : null}
        </FilterBar>
      ) : null}

      <Panel id="audit-heading" title={t("heading")} icon={ScrollText}>
        <FilterChips
          label={t("filters.kinds")}
          active={state.action ?? "all"}
          chips={[
            { key: "all", label: t("filters.all"), href: actionHref(query, null) },
            ...AUDIT_ACTIONS.map((action) => ({
              key: action,
              label: t(`kinds.${actionKey(action.replace(/\.$/, ""))}`),
              href: actionHref(query, action),
            })),
          ]}
        />
        {page.items.length === 0 ? (
          <EmptyState
            title={state.before ? t("empty.older") : filtered ? t("empty.filtered") : t("empty.all")}
            lead={filtered ? t("empty.filteredLead") : undefined}
            action={
              filtered || state.before ? (
                <Link href="/audit" className={buttonClass({ variant: "secondary", size: "console" })}>
                  {t("empty.showAll")}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <AuditEvents events={page.items} now={now} details label={t("listLabel")} />
        )}
        {state.before || page.next_before ? (
          <nav aria-label={t("paging")} className="flex flex-wrap justify-between gap-2.5 border-t border-border pt-3">
            {state.before ? (
              <Link href={newestHref(query)} className={buttonClass({ variant: "secondary", size: "console" })}>
                <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2.2} />
                {t("newest")}
              </Link>
            ) : (
              <span />
            )}
            {page.next_before ? (
              <Link href={olderHref(query, page.next_before)} className={buttonClass({ variant: "secondary", size: "console" })}>
                {t("older")}
                <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
              </Link>
            ) : null}
          </nav>
        ) : null}
      </Panel>
    </>
  );
}
