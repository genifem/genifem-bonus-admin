import type { Schemas } from "@crewstars/api-client";
import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { cx } from "@/components/ui";

import { Ago } from "./parts";

type Summary = Schemas["PlatformHealthSummaryOut"];

const STATUS = {
  ok: { icon: CircleCheck, chip: "bg-success-subtle text-success-ink" },
  watch: { icon: TriangleAlert, chip: "bg-warning-subtle text-warning-ink" },
  problem: { icon: CircleAlert, chip: "bg-danger-subtle text-danger-ink" },
} as const;

/** The health page in one card (GET /platform/overview's `health`): the verdict in words
 *  (never colour alone), then what it was made from. */
export async function HealthSummary({ health, now }: { health: Summary; now: Date }) {
  const [t, format] = await Promise.all([getTranslations("platform.health"), getFormatter()]);
  const { icon: Icon, chip } = STATUS[health.status];
  const jobs = (names: readonly string[]) =>
    names.length ? names.map((name) => (t.has(`jobs.${name}`) ? t(`jobs.${name}`) : name)).join(", ") : t("none");
  return (
    <div className="flex flex-col gap-3">
      <p className={cx("flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-extrabold", chip)}>
        <Icon aria-hidden="true" className="size-5 shrink-0" strokeWidth={2.2} />
        {t(`status.${health.status}`)}
      </p>
      <dl className="grid grid-cols-1 gap-x-4 gap-y-2.5 text-sm @lg/page:grid-cols-2">
        <Row label={t("database")}>{t(`database_${health.database}`)}</Row>
        <Row label={t("email")}>{health.email_configured ? t("configured") : t("notConfigured")}</Row>
        <Row label={t("lastBackup")}>
          {t(`run.${health.last_backup_status}`)}
          {health.last_backup_at ? (
            <>
              {" · "}
              <Ago format={format} iso={health.last_backup_at} now={now} never="" />
            </>
          ) : null}
        </Row>
        <Row label={t("failingJobs")}>{jobs(health.failing_jobs)}</Row>
        <Row label={t("staleJobs")}>{jobs(health.stale_jobs)}</Row>
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className="break-words font-semibold">{children}</dd>
    </div>
  );
}
