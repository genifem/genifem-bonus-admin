import type { Schemas } from "@crewstars/api-client";
import { Bell, Building2, Database, HardDriveDownload, Mail, MessageSquare, Timer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { Ago, NoAccess, when } from "@/components/backoffice/parts";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { Alert, Badge, DataTable, PageHeader, StatTile, type BadgeTone, type Column } from "@/components/ui";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  return { title: t("health") };
}

type JobRun = Schemas["JobRunOut"];

const RUN_TONE: Record<JobRun["status"], BadgeTone> = {
  ok: "success",
  running: "brand",
  failed: "danger",
  never: "neutral",
};

/**
 * Health (P7), from GET /platform/health: the database and how long it took to answer, which
 * email, texting and push are switched on, the last backup and restore drill, and every
 * scheduled job with when it last ran - a job that has not run when it should is "late". The
 * verdict (all good, worth a look, needs attention) is the overview's.
 */
export default async function HealthPage() {
  const admin = await requirePlatformAdmin();
  const [t, tOverview, te, format, locale] = await Promise.all([
    getTranslations("platform.health"),
    getTranslations("platform.overview"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);
  const now = new Date();

  if (!can(admin, "health.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="health.read" />
      </>
    );
  }

  const loaded = await settle("/health", async () => body(await (await serverApi()).GET("/api/v1/platform/health")));
  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={t("title")} lead={t("lead")} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href="/health" className="font-extrabold underline underline-offset-2">
            {tOverview("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const health = loaded.data;
  const jobName = (name: string) => (t.has(`jobs.${name}`) ? t(`jobs.${name}`) : name);
  const every = (seconds: number | null) =>
    seconds === null
      ? t("everyNone")
      : seconds % 3600 === 0
        ? t("everyHours", { count: seconds / 3600 })
        : t("everyMinutes", { count: Math.round(seconds / 60) });
  const onOff = (on: boolean) => (on ? t("on") : t("off"));

  const columns: Column<JobRun>[] = [
    {
      key: "job",
      header: t("columns.job"),
      overflow: "wrap",
      cell: (job) => (
        <>
          <b className="font-extrabold">{jobName(job.name)}</b>
          <code translate="no" className="block font-mono text-caption text-muted">
            {job.name}
          </code>
        </>
      ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (job) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={RUN_TONE[job.status]}>{t(`run.${job.status}`)}</Badge>
          {job.stale ? <Badge tone="warning">{t("late")}</Badge> : null}
        </span>
      ),
    },
    { key: "every", header: t("columns.every"), hideBelow: "md", cell: (job) => every(job.every_s) },
    {
      key: "last",
      header: t("columns.last"),
      cell: (job) => <Ago format={format} iso={job.finished_at ?? job.started_at} now={now} never={t("never")} />,
    },
    {
      key: "error",
      header: t("columns.error"),
      overflow: "truncate",
      hideBelow: "lg",
      cellTitle: (job) => job.error ?? undefined,
      cell: (job) => (job.error ? <span className="text-danger-ink">{job.error}</span> : <span className="text-muted">-</span>),
    },
  ];

  const backups: JobRun[] = [health.backup, health.restore_drill];

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("checkedAt", {
          when: when(format, health.checked_at) ?? "",
          env: health.env,
          version: health.version ?? t("noVersion"),
        })}
      />

      <div className="grid grid-cols-2 gap-tile @3xl/page:grid-cols-3 @5xl/page:grid-cols-5">
        <StatTile
          label={t("database")}
          value={t(`database_${health.database.status}`)}
          hint={
            health.database.latency_ms !== null ? t("latency", { ms: formatCount(health.database.latency_ms, locale) }) : undefined
          }
          icon={<Database className="size-4.5" strokeWidth={2.2} />}
          tone={health.database.status === "ok" ? "success" : "danger"}
        />
        <StatTile
          label={t("email")}
          value={health.providers.email.configured ? t("configured") : t("notConfigured")}
          hint={t(`providers.${health.providers.email.provider}`)}
          icon={<Mail className="size-4.5" strokeWidth={2.2} />}
          tone={health.providers.email.configured ? "success" : "warning"}
        />
        <StatTile
          label={t("sms")}
          value={onOff(health.providers.sms.enabled)}
          hint={health.providers.sms.configured ? t("configured") : t("notConfigured")}
          icon={<MessageSquare className="size-4.5" strokeWidth={2.2} />}
          tone="neutral"
        />
        <StatTile
          label={t("push")}
          value={onOff(health.providers.push.enabled)}
          icon={<Bell className="size-4.5" strokeWidth={2.2} />}
          tone="neutral"
        />
        <StatTile
          label={t("operators")}
          value={formatCount(health.operators.total, locale)}
          hint={tOverview("kpi.operatorsHint", {
            active: formatCount(health.operators.active, locale),
            suspended: formatCount(health.operators.suspended, locale),
          })}
          icon={<Building2 className="size-4.5" strokeWidth={2.2} />}
          tone="brand"
          className="col-span-2 @3xl/page:col-span-1"
        />
      </div>

      {/* The jobs table needs the page's width for its columns; the backups sit under it. */}
      <Panel id="jobs-heading" title={t("jobsTitle")} icon={Timer} lead={t("jobsLead")} flush>
        <DataTable
          caption={t("jobsTitle")}
          columns={columns}
          rows={health.jobs}
          rowKey={(job) => job.name}
          bare
          className="border-t border-border"
        />
      </Panel>

      <Panel id="backup-heading" title={t("backupsTitle")} icon={HardDriveDownload} lead={t("backupsLead")}>
        <ul className="flex flex-col">
          {backups.map((run) => (
            <li key={run.name} className="flex flex-col gap-1 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
              <span className="flex flex-wrap items-center gap-2">
                <b className="font-extrabold">{jobName(run.name)}</b>
                <Badge tone={RUN_TONE[run.status]}>{t(`run.${run.status}`)}</Badge>
              </span>
              <span className="text-sm text-muted">
                <Ago format={format} iso={run.finished_at ?? run.started_at} now={now} never={t("never")} />
              </span>
              {run.error ? <span className="break-words text-sm text-danger-ink">{run.error}</span> : null}
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
