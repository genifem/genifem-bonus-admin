import type { Schemas } from "@crewstars/api-client";
import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Ago, NoAccess, OPERATOR_TONE, when } from "@/components/backoffice/parts";
import { formatCount } from "@/components/recognition/numbers";
import {
  Alert,
  Badge,
  buttonClass,
  DataTable,
  EmptyState,
  Field,
  FilterBar,
  PageHeader,
  readString,
  SelectField,
  withQuery,
  type Column,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  return { title: t("operators") };
}

type OperatorRow = Schemas["OperatorRowOut"];
const STATUSES = ["active", "suspended"] as const;
type Status = (typeof STATUSES)[number];

/**
 * Operators (P7): every company on Crew Stars with its numbers - stores, people, owners and this
 * month's shout-outs - and when it was last busy, from GET /platform/operators. Searched by
 * name or address and filtered by status on the server, both in the URL, like every list in
 * the portal. A role that may create operators gets "New operator" above it.
 */
export default async function OperatorsPage({ searchParams }: PageProps<"/platform/operators">) {
  const query = (await searchParams) as Query;
  const admin = await requirePlatformAdmin();
  const [t, tOverview, te, format, locale] = await Promise.all([
    getTranslations("platform.operators"),
    getTranslations("platform.overview"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);
  const now = new Date();
  const q = readString(query, "q")?.trim().slice(0, 80) || undefined;
  const raw = readString(query, "status");
  const status: Status | undefined = (STATUSES as readonly string[]).includes(raw ?? "") ? (raw as Status) : undefined;
  const here = `/operators${withQuery(query, {})}`;
  const newOperator = can(admin, "operators.write") ? (
    <Link href="/operators/new" className={buttonClass({ size: "console" })}>
      <Plus aria-hidden="true" className="size-4.5" strokeWidth={2.2} />
      {tOverview("newOperator")}
    </Link>
  ) : undefined;

  if (!can(admin, "operators.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="operators.read" />
      </>
    );
  }

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    return body(await api.GET("/api/v1/platform/operators", { params: { query: { q, status } } }));
  });

  const count = (value: number) => formatCount(value, locale);
  const columns: Column<OperatorRow>[] = [
    {
      key: "operator",
      header: t("columns.operator"),
      overflow: "wrap",
      cell: (row) => (
        <>
          <Link
            href={`/operators/${row.id}`}
            className={`font-extrabold text-foreground underline-offset-2 hover:underline ${ringInside}`}
          >
            {row.name}
          </Link>
          <span translate="no" className="block break-all text-caption text-muted">
            {row.portal_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (row) => <Badge tone={OPERATOR_TONE[row.status]}>{tOverview(`status.${row.status}`)}</Badge>,
    },
    { key: "stores", header: t("columns.stores"), align: "end", cell: (row) => count(row.stores) },
    { key: "people", header: t("columns.people"), align: "end", cell: (row) => count(row.people) },
    { key: "owners", header: t("columns.owners"), align: "end", hideBelow: "lg", cell: (row) => count(row.owners) },
    {
      key: "shoutouts",
      header: t("columns.shoutouts"),
      align: "end",
      cell: (row) => <b className="font-black">{count(row.shoutouts_month)}</b>,
    },
    {
      key: "activity",
      header: t("columns.activity"),
      hideBelow: "md",
      cell: (row) => <Ago format={format} iso={row.last_activity_at} now={now} never={tOverview("operators.never")} />,
    },
    {
      key: "created",
      header: t("columns.created"),
      hideBelow: "xl",
      overflow: "nowrap",
      cell: (row) => format.dateTime(new Date(row.created_at), { dateStyle: "medium", timeZone: "UTC" }),
      // The exact moment is a hover away.
      cellTitle: (row) => when(format, row.created_at) ?? undefined,
    },
  ];

  const filtered = Boolean(q || status);
  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} action={newOperator} />

      <FilterBar
        action="/operators"
        query={query}
        label={t("filters.label")}
        submitLabel={t("filters.apply")}
        className="rounded-2xl border border-border bg-surface-raised p-4.5"
      >
        <div className="w-full sm:w-72">
          <Field
            label={t("filters.search")}
            name="q"
            type="search"
            defaultValue={q ?? ""}
            placeholder={t("filters.searchPlaceholder")}
            maxLength={80}
          />
        </div>
        <div className="w-full sm:w-48">
          <SelectField label={t("filters.status")} name="status" defaultValue={status ?? ""}>
            <option value="">{t("filters.anyStatus")}</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {tOverview(`status.${value}`)}
              </option>
            ))}
          </SelectField>
        </div>
      </FilterBar>

      {!loaded.ok ? (
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {tOverview("retry")}
          </Link>
        </Alert>
      ) : (
        <DataTable
          caption={t("caption", { count: loaded.data.items.length })}
          columns={columns}
          rows={loaded.data.items}
          rowKey={(row) => row.id}
          empty={
            filtered ? (
              <EmptyState
                title={t("empty.filtered")}
                lead={t("empty.filteredLead")}
                action={
                  <Link href="/operators" className={buttonClass({ variant: "secondary", size: "console" })}>
                    {t("empty.clear")}
                  </Link>
                }
              />
            ) : (
              <EmptyState title={tOverview("operators.empty")} lead={tOverview("operators.emptyLead")} action={newOperator} />
            )
          }
        />
      )}
    </>
  );
}
