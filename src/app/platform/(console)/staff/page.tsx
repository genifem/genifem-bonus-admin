import type { Schemas } from "@crewstars/api-client";
import { UserCog } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { Ago, NoAccess, staffState, StateBadge } from "@/components/backoffice/parts";
import { InviteStaff, StaffRowActions } from "@/components/backoffice/StaffActions";
import { Panel } from "@/components/recognition/Panel";
import { Alert, Badge, DataTable, PageHeader, type Column } from "@/components/ui";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  return { title: t("staff") };
}

type Staff = Schemas["StaffOut"];

/**
 * Staff (P7): the people who can sign in to the back office, from GET /platform/staff, with
 * their role, where they stand (invited, active, locked, suspended), whether their
 * authenticator is set up and when they last signed in. Super admins only (staff.read); one
 * who may also change it (staff.write) gets Invite and each colleague's actions. Their own row
 * has none.
 */
export default async function StaffPage() {
  const admin = await requirePlatformAdmin();
  const [t, tRoles, tStates, tOverview, te, format] = await Promise.all([
    getTranslations("platform.staff"),
    getTranslations("platform.shell.roles"),
    getTranslations("platform.states"),
    getTranslations("platform.overview"),
    getTranslations("errors"),
    getFormatter(),
  ]);
  const now = new Date();

  if (!can(admin, "staff.read")) {
    return (
      <>
        <PageHeader title={t("title")} />
        <NoAccess title={t("title")} lead={t("noAccess")} permission="staff.read" />
      </>
    );
  }

  const canWrite = can(admin, "staff.write");
  const loaded = await settle("/staff", async () => body(await (await serverApi()).GET("/api/v1/platform/staff")));
  const invite = canWrite ? <InviteStaff /> : undefined;

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={t("title")} lead={t("lead")} action={invite} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href="/staff" className="font-extrabold underline underline-offset-2">
            {tOverview("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const columns: Column<Staff>[] = [
    {
      key: "person",
      header: t("columns.person"),
      overflow: "wrap",
      cell: (staff) => (
        <>
          <b className="font-extrabold">{staff.name}</b>
          {staff.id === admin.id ? (
            <Badge tone="neutral" className="ml-1.5 align-middle">
              {t("you")}
            </Badge>
          ) : null}
          <span className="block break-all text-caption text-muted">{staff.email}</span>
        </>
      ),
    },
    { key: "role", header: t("columns.role"), cell: (staff) => tRoles(staff.role) },
    {
      key: "state",
      header: t("columns.state"),
      cell: (staff) => {
        const state = staffState(staff);
        return <StateBadge state={state} label={tStates(state)} />;
      },
    },
    {
      key: "mfa",
      header: t("columns.mfa"),
      hideBelow: "lg",
      cell: (staff) => (staff.mfa_enabled ? t("mfaOn") : <span className="text-muted">{t("mfaOff")}</span>),
    },
    {
      key: "signedIn",
      header: t("columns.signedIn"),
      hideBelow: "md",
      cell: (staff) => <Ago format={format} iso={staff.last_login_at} now={now} never={t("never")} />,
    },
    ...(canWrite
      ? [
          {
            key: "actions",
            header: t("columns.actions"),
            pin: "end" as const,
            width: "min" as const,
            cell: (staff: Staff) =>
              staff.id === admin.id ? (
                <span className="text-caption text-muted">{t("ownRow")}</span>
              ) : (
                <StaffRowActions staff={staff} canWrite={canWrite} />
              ),
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} action={invite} />
      <Panel id="staff-heading" title={t("heading", { count: loaded.data.items.length })} icon={UserCog} lead={t("roles")} flush>
        <DataTable
          caption={t("caption")}
          columns={columns}
          rows={loaded.data.items}
          rowKey={(staff) => staff.id}
          bare
          className="border-t border-border"
        />
      </Panel>
    </>
  );
}
