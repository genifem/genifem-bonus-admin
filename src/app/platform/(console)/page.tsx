import type { Schemas } from "@crewstars/api-client";
import { Activity, Building2, ChevronRight, Gift, MessageCircle, Plus, ScrollText, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { AuditEvents } from "@/components/backoffice/AuditEvents";
import { HealthSummary } from "@/components/backoffice/HealthSummary";
import { Ago, NoAccess, OPERATOR_TONE } from "@/components/backoffice/parts";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import {
  Alert,
  Badge,
  buttonClass,
  Columns,
  DataTable,
  EmptyState,
  PageHeader,
  StatTile,
  type Column,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  return { title: t("overview") };
}

type OperatorRow = Schemas["OperatorRowOut"];

/** The operators listed here before "All operators": the most recently busy. */
const FIRST_OPERATORS = 6;
/** The back office's own latest actions. */
const RECENT_EVENTS = 6;

/** The month the API reports ("2026-11") as a date to name it by, read in UTC. */
function monthDate(month: string): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : new Date();
}

/**
 * The back office's overview (P7), from GET /platform/overview: how many operators there are
 * and how many are suspended, the people on their rosters, this month's shout-outs and
 * redemptions across them, and the health page in one card. Beside it, for a role that reads
 * them, the busiest operators and what the back office did last.
 */
export default async function PlatformOverviewPage() {
  const admin = await requirePlatformAdmin();
  const [t, tAudit, te, format, locale] = await Promise.all([
    getTranslations("platform.overview"),
    getTranslations("platform.audit"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);
  const now = new Date();
  const canCreate = can(admin, "operators.write");
  const newOperator = canCreate ? (
    <Link href="/operators/new" className={buttonClass({ size: "console" })}>
      <Plus aria-hidden="true" className="size-4.5" strokeWidth={2.2} />
      {t("newOperator")}
    </Link>
  ) : undefined;

  if (!can(admin, "overview.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="overview.read" />
      </>
    );
  }

  const loaded = await settle("/", async () => {
    const api = await serverApi();
    const [overview, operators, audit] = await Promise.all([
      api.GET("/api/v1/platform/overview").then(body),
      can(admin, "operators.read")
        ? api
            .GET("/api/v1/platform/operators")
            .then(body)
            .catch(() => null)
        : null,
      can(admin, "audit.read")
        ? api
            .GET("/api/v1/platform/audit", { params: { query: { limit: RECENT_EVENTS } } })
            .then(body)
            .catch(() => null)
        : null,
    ]);
    return { overview, operators, audit };
  });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={t("title")} action={newOperator} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href="/" className="font-extrabold underline underline-offset-2">
            {t("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { overview, operators, audit } = loaded.data;
  const month = format.dateTime(monthDate(overview.month), { month: "long", year: "numeric", timeZone: "UTC" });
  const count = (value: number) => formatCount(value, locale);
  const busiest = [...(operators?.items ?? [])]
    .sort((a, b) => (b.last_activity_at ?? "").localeCompare(a.last_activity_at ?? "") || a.name.localeCompare(b.name))
    .slice(0, FIRST_OPERATORS);

  const columns: Column<OperatorRow>[] = [
    {
      key: "operator",
      header: t("operators.columns.operator"),
      overflow: "wrap",
      cell: (row) => (
        <>
          <Link
            href={`/operators/${row.id}`}
            className={`font-extrabold text-foreground underline-offset-2 hover:underline ${ringInside}`}
          >
            {row.name}
          </Link>
          <span translate="no" className="block text-caption text-muted">
            {row.slug}
          </span>
        </>
      ),
    },
    {
      key: "status",
      header: t("operators.columns.status"),
      cell: (row) => <Badge tone={OPERATOR_TONE[row.status]}>{t(`status.${row.status}`)}</Badge>,
    },
    {
      key: "shoutouts",
      header: t("operators.columns.shoutouts"),
      align: "end",
      cell: (row) => <b className="font-black">{count(row.shoutouts_month)}</b>,
    },
    {
      key: "activity",
      header: t("operators.columns.activity"),
      hideBelow: "md",
      cell: (row) => <Ago format={format} iso={row.last_activity_at} now={now} never={t("operators.never")} />,
    },
  ];

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead", { month })} action={newOperator} />

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          {t("kpi.label", { month })}
        </h2>
        <div className="grid grid-cols-2 gap-tile @4xl/page:grid-cols-4">
          <StatTile
            label={t("kpi.operators")}
            value={count(overview.operators.total)}
            hint={t("kpi.operatorsHint", {
              active: count(overview.operators.active),
              suspended: count(overview.operators.suspended),
            })}
            icon={<Building2 className="size-4.5" strokeWidth={2.2} />}
            tone="brand"
            href={can(admin, "operators.read") ? "/operators" : undefined}
          />
          <StatTile
            label={t("kpi.people")}
            value={count(overview.active_people)}
            hint={t("kpi.peopleHint")}
            icon={<Users className="size-4.5" strokeWidth={2.2} />}
            tone="success"
          />
          <StatTile
            label={t("kpi.shoutouts")}
            value={count(overview.shoutouts_month)}
            hint={t("kpi.monthHint")}
            icon={<MessageCircle className="size-4.5" strokeWidth={2.2} />}
            tone="warning"
          />
          <StatTile
            label={t("kpi.redemptions")}
            value={count(overview.redemptions_month)}
            hint={t("kpi.monthHint")}
            icon={<Gift className="size-4.5" strokeWidth={2.2} />}
            tone="reward"
          />
        </div>
      </section>

      <Columns layout="halves" align="stretch">
        <Panel
          id="health-heading"
          title={t("health.title")}
          icon={Activity}
          action={
            can(admin, "health.read") ? (
              <Link href="/health" className={buttonClass({ variant: "ghost", size: "xs" })}>
                {t("health.open")}
                <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
              </Link>
            ) : undefined
          }
        >
          <HealthSummary health={overview.health} now={now} />
        </Panel>

        {operators ? (
          <Panel
            id="operators-heading"
            title={t("operators.title")}
            icon={Building2}
            flush
            action={
              <Link href="/operators" className={buttonClass({ variant: "ghost", size: "xs" })}>
                {t("operators.all")}
                <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
              </Link>
            }
          >
            {busiest.length === 0 ? (
              <div className="px-4.5 pb-4.5">
                <EmptyState title={t("operators.empty")} lead={t("operators.emptyLead")} action={newOperator} />
              </div>
            ) : (
              <DataTable
                caption={t("operators.caption")}
                columns={columns}
                rows={busiest}
                rowKey={(row) => row.id}
                bare
                className="border-t border-border"
              />
            )}
          </Panel>
        ) : null}
      </Columns>

      {audit ? (
        <Panel
          id="activity-heading"
          title={t("activity.title")}
          icon={ScrollText}
          action={
            <Link href="/audit" className={buttonClass({ variant: "ghost", size: "xs" })}>
              {t("activity.all")}
              <ChevronRight aria-hidden="true" className="size-4" strokeWidth={2.2} />
            </Link>
          }
        >
          {audit.items.length === 0 ? (
            <p className="text-sm text-muted">{t("activity.empty")}</p>
          ) : (
            <AuditEvents events={audit.items} now={now} label={tAudit("listLabel")} />
          )}
        </Panel>
      ) : null}
    </>
  );
}
