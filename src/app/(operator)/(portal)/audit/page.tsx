import { ScrollText } from "lucide-react";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { AuditEntry } from "@/components/audit/AuditEntry";
import { auditBook } from "@/components/audit/audit-format";
import {
  AUDIT_KINDS,
  auditApiQuery,
  auditState,
  everyoneHref,
  kindHref,
} from "@/components/audit/audit-query";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { portalMetadata } from "@/components/console/PortalPage";
import { Panel } from "@/components/recognition/Panel";
import { Alert, buttonClass, EmptyState, FilterChips, PageHeader, withQuery, type Query } from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("audit");
}

/**
 * Audit log (NF-09, plan §9): every change to the rules, rewards, approvals, shout-outs, the
 * roster and sign-in, newest first - who made it, when, and the values before and after.
 * Filtered by kind of change, or to one record's history (`?target=`, from a person's row on
 * Roster), both in the URL.
 *
 * Read here on the server: the first page of GET /portal/audit, and, to name the ids an event
 * holds (a store, a badge, a prize), the stores, the areas and the settings, any of which may
 * fail without taking the log with it: the ids are then said generically. Older pages come
 * from the browser through the BFF ("Load more", AuditTimeline).
 */
export default async function AuditPage({ searchParams }: PageProps<"/audit">) {
  const query = (await searchParams) as Query;
  const state = auditState(query);
  const here = `/audit${withQuery(query, {})}`;
  const now = new Date();
  const [t, tPage, te, locale] = await Promise.all([
    getTranslations("audit"),
    getTranslations("pages.audit"),
    getTranslations("errors"),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [page, stores, areas, settings] = await Promise.all([
      api.GET("/api/v1/portal/audit", { params: { query: auditApiQuery(state) } }).then(body),
      api
        .GET("/api/v1/portal/stores")
        .then(body)
        .catch(() => null),
      api
        .GET("/api/v1/portal/areas")
        .then(body)
        .catch(() => null),
      api
        .GET("/api/v1/portal/settings")
        .then(body)
        .catch(() => null),
    ]);
    return { page, book: auditBook({ stores, areas, rules: settings?.rules ?? null }, locale) };
  });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={tPage("title")} lead={tPage("lead")} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {t("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { page, book } = loaded.data;
  // One record's history is named by its entries; with none yet, it is said generically.
  const targetName = state.target
    ? (page.items.find((item) => item.target?.id === state.target && item.target.label)?.target?.label ?? null)
    : null;
  const showAll = (
    <Link href="/audit" className={buttonClass({ variant: "secondary", size: "console" })}>
      {t("empty.showAll")}
    </Link>
  );
  const empty = state.target
    ? { title: t("empty.target"), lead: t("empty.targetLead") }
    : state.kind
      ? { title: t("empty.kind"), lead: t("empty.kindLead") }
      : { title: t("empty.all"), lead: t("empty.allLead") };

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />

      {state.target ? (
        <Alert kind="info">
          {targetName ? t("history.of", { name: targetName }) : t("history.ofUnknown")}{" "}
          <Link href={everyoneHref(query)} className="font-extrabold text-brand-ink underline underline-offset-2">
            {t("history.everyone")}
          </Link>
        </Alert>
      ) : null}

      <Panel id="audit-heading" title={t("heading")} icon={ScrollText}>
        <FilterChips
          label={t("filters.label")}
          active={state.kind ?? "all"}
          chips={[
            { key: "all", label: t("filters.all"), href: kindHref(query, null) },
            ...AUDIT_KINDS.map((kind) => ({ key: kind, label: t(`kinds.${kind}`), href: kindHref(query, kind) })),
          ]}
        />
        {page.items.length === 0 ? (
          <EmptyState title={empty.title} lead={empty.lead} action={state.kind || state.target ? showAll : undefined} />
        ) : (
          <AuditTimeline
            // A filter starts the list over.
            key={`${state.kind ?? ""}:${state.target ?? ""}`}
            state={state}
            cursor={page.next_before}
            book={book}
            now={now.toISOString()}
            label={t("listLabel")}
          >
            {page.items.map((event) => (
              <AuditEntry key={event.id} event={event} book={book} now={now} historyOf={state.target} />
            ))}
          </AuditTimeline>
        )}
      </Panel>
    </>
  );
}
