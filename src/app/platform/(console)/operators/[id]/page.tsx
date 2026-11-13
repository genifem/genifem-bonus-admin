import type { Schemas } from "@crewstars/api-client";
import {
  Building2,
  ChevronLeft,
  Coins,
  Gift,
  Globe,
  Hourglass,
  MailCheck,
  MailWarning,
  MessageCircle,
  ScrollText,
  ShieldAlert,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { AddressSetup } from "@/components/backoffice/AddressSetup";
import { AuditEvents } from "@/components/backoffice/AuditEvents";
import {
  AddOwner,
  EditOperator,
  OperatorStatusAction,
  OwnerActions,
  ResendInvite,
} from "@/components/backoffice/OperatorActions";
import { timeZoneLabel } from "@/components/backoffice/operator-form";
import { ownerPermissionsOf } from "@/components/backoffice/owner-actions";
import { Ago, NoAccess, OPERATOR_TONE, ownerState, StateBadge, when } from "@/components/backoffice/parts";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import {
  Alert,
  Badge,
  Columns,
  DataTable,
  EmptyState,
  PageHeader,
  readString,
  StatTile,
  type Column,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { can, requirePlatformAdmin } from "@/lib/platform";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

type Owner = Schemas["PlatformOwnerOut"];

/** A Mongo id, which is all the API takes: anything else is not an operator. */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export async function generateMetadata({ params }: PageProps<"/platform/operators/[id]">): Promise<Metadata> {
  const t = await getTranslations("platform.shell.nav");
  const { id } = await params;
  if (!OBJECT_ID.test(id)) return { title: t("operators") };
  try {
    const { data } = await (await serverApi()).GET("/api/v1/platform/operators/{operator_id}", {
      params: { path: { operator_id: id } },
    });
    return { title: data?.name ?? t("operators") };
  } catch {
    return { title: t("operators") };
  }
}

/**
 * One operator (P7): its status and portal address, this month's usage, its owners with what
 * can be done for each (send the invite again, turn off a lost authenticator, suspend), the back
 * office's latest actions on it, its details with Edit, and the danger zone (suspend or
 * reactivate). Every write asks for a reason first.
 *
 * Straight after New operator (`?created=1&invite=sent|failed`) it opens with what is left to
 * do: put the address online (a CNAME and a Vercel domain, AddressSetup) and how the invite
 * email went, with Send again when it failed.
 */
export default async function OperatorPage({ params, searchParams }: PageProps<"/platform/operators/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams as Promise<Query>]);
  if (!OBJECT_ID.test(id)) notFound();
  const admin = await requirePlatformAdmin();
  const [t, tOverview, tAudit, tStates, te, format, locale] = await Promise.all([
    getTranslations("platform.operator"),
    getTranslations("platform.overview"),
    getTranslations("platform.audit"),
    getTranslations("platform.states"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);
  const now = new Date();
  const here = `/operators/${id}`;

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
    const path = { params: { path: { operator_id: id } } };
    const [operator, owners] = await Promise.all([
      api.GET("/api/v1/platform/operators/{operator_id}", path).then(body),
      api.GET("/api/v1/platform/operators/{operator_id}/owners", path).then(body),
    ]);
    return { operator, owners: owners.items };
  });

  const back = (
    <Link
      href="/operators"
      className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
    >
      <ChevronLeft aria-hidden="true" className="size-4" strokeWidth={2.4} />
      {t("back")}
    </Link>
  );

  if (!loaded.ok) {
    if (loaded.code === "operator_not_found") notFound();
    return (
      <>
        {back}
        <PageHeader title={t("title")} />
        <Alert kind="error">
          {t("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {tOverview("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { operator, owners } = loaded.data;
  const count = (value: number) => formatCount(value, locale);
  const created = readString(query, "created") === "1";
  const invite = readString(query, "invite");
  const firstOwner = owners.find((owner) => owner.invited) ?? owners[0];
  const canWrite = can(admin, "operators.write");
  // Adding an owner is super_admin's; support can resend an invite (owner-actions.ts).
  const ownerPermissions = ownerPermissionsOf(admin.permissions);
  const month = format.dateTime(new Date(`${operator.usage.month}-01T00:00:00Z`), {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  const ownerColumns: Column<Owner>[] = [
    {
      key: "owner",
      header: t("owners.columns.owner"),
      overflow: "wrap",
      cell: (owner) => (
        <>
          <b className="font-extrabold">{owner.name}</b>
          <span className="block break-all text-caption text-muted">{owner.email}</span>
        </>
      ),
    },
    {
      key: "state",
      header: t("owners.columns.state"),
      cell: (owner) => {
        const state = ownerState(owner);
        return <StateBadge state={state} label={tStates(state)} />;
      },
    },
    {
      key: "mfa",
      header: t("owners.columns.mfa"),
      hideBelow: "lg",
      cell: (owner) => (owner.mfa_enabled ? t("owners.mfaOn") : <span className="text-muted">{t("owners.mfaOff")}</span>),
    },
    {
      key: "signedIn",
      header: t("owners.columns.signedIn"),
      hideBelow: "md",
      cell: (owner) => <Ago format={format} iso={owner.last_login_at} now={now} never={t("owners.never")} />,
    },
    {
      key: "actions",
      header: t("owners.columns.actions"),
      pin: "end",
      width: "min",
      cell: (owner) => <OwnerActions operatorId={operator.id} owner={owner} permissions={ownerPermissions} />,
    },
  ];

  return (
    <>
      {back}
      <PageHeader
        title={operator.name}
        lead={t("lead", { slug: operator.slug })}
        action={canWrite ? <EditOperator operator={operator} /> : undefined}
      />
      <div className="-mt-3 flex flex-wrap items-center gap-2.5">
        <Badge tone={OPERATOR_TONE[operator.status]}>{tOverview(`status.${operator.status}`)}</Badge>
        <a
          href={operator.portal_url}
          target="_blank"
          rel="noreferrer"
          translate="no"
          className="inline-flex min-h-11 items-center break-all text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
        >
          {operator.portal_url.replace(/^https?:\/\//, "").replace(/\/$/, "")}
          <span className="sr-only"> {t("address.newTab")}</span>
        </a>
      </div>

      {operator.status === "suspended" ? (
        <Alert kind="warning">{t("suspendedNote")}</Alert>
      ) : null}

      {created ? (
        <Panel id="setup-heading" title={t("setup.title")} icon={Globe} lead={t("setup.lead", { name: operator.name })}>
          <div className="flex flex-col gap-4">
            <Alert kind="success">{t("setup.created", { name: operator.name })}</Alert>
            <section aria-labelledby="setup-address" className="flex flex-col gap-2">
              <h3 id="setup-address" className="text-sm font-black">
                {t("setup.address")}
              </h3>
              <AddressSetup slug={operator.slug} portalUrl={operator.portal_url} />
            </section>
            {firstOwner ? (
              <section aria-labelledby="setup-invite" className="flex flex-col gap-2 border-t border-border pt-4">
                <h3 id="setup-invite" className="text-sm font-black">
                  {t("setup.invite")}
                </h3>
                {invite === "failed" ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="flex min-w-0 flex-1 items-start gap-2 text-sm font-semibold text-danger-ink">
                      <MailWarning aria-hidden="true" className="mt-px size-4.5 shrink-0" strokeWidth={2.2} />
                      {t("setup.inviteFailed", { email: firstOwner.email })}
                    </p>
                    {ownerPermissions.resend && firstOwner.invited ? (
                      <ResendInvite operatorId={operator.id} owner={firstOwner} variant="primary" />
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-start gap-2 text-sm">
                    <MailCheck aria-hidden="true" className="mt-px size-4.5 shrink-0 text-success-ink" strokeWidth={2.2} />
                    {t("setup.inviteSent", { email: firstOwner.email })}
                  </p>
                )}
              </section>
            ) : null}
          </div>
        </Panel>
      ) : null}

      <section aria-labelledby="usage-heading">
        <h2 id="usage-heading" className="mb-2.5 text-title font-black">
          {t("usage.title", { month })}
        </h2>
        <div className="grid grid-cols-2 gap-tile @2xl/page:grid-cols-3 @5xl/page:grid-cols-5">
          <StatTile
            label={t("usage.active")}
            value={count(operator.usage.active_people)}
            hint={t("usage.activeHint", { people: count(operator.people) })}
            icon={<Users className="size-4.5" strokeWidth={2.2} />}
            tone="success"
          />
          <StatTile
            label={t("usage.shoutouts")}
            value={count(operator.usage.shoutouts)}
            icon={<MessageCircle className="size-4.5" strokeWidth={2.2} />}
            tone="brand"
          />
          <StatTile
            label={t("usage.coins")}
            value={count(operator.usage.coins_earned)}
            icon={<Coins className="size-4.5" strokeWidth={2.2} />}
            tone="warning"
          />
          <StatTile
            label={t("usage.redemptions")}
            value={count(operator.usage.redemptions)}
            icon={<Gift className="size-4.5" strokeWidth={2.2} />}
            tone="reward"
          />
          <StatTile
            label={t("usage.waiting")}
            value={count(operator.usage.pending_requests)}
            hint={t("usage.waitingHint")}
            icon={<Hourglass className="size-4.5" strokeWidth={2.2} />}
            tone="danger"
            className="col-span-2 @2xl/page:col-span-1"
          />
        </div>
      </section>

      <Columns layout="aside">
        <div className="flex min-w-0 flex-col gap-section">
          <Panel
            id="owners-heading"
            title={t("owners.title", { count: owners.length })}
            icon={Users}
            lead={t("owners.lead")}
            flush
            action={ownerPermissions.add ? <AddOwner operator={operator} /> : undefined}
          >
            <DataTable
              caption={t("owners.caption", { name: operator.name })}
              columns={ownerColumns}
              rows={owners}
              rowKey={(owner) => owner.id}
              bare
              className="border-t border-border"
              empty={<EmptyState title={t("owners.empty")} lead={t("owners.emptyLead")} />}
            />
          </Panel>

          <Panel id="activity-heading" title={t("activity.title")} icon={ScrollText} lead={t("activity.lead")}>
            {operator.recent_audit.length === 0 ? (
              <p className="text-sm text-muted">{t("activity.empty")}</p>
            ) : (
              <AuditEvents events={operator.recent_audit} now={now} operatorLinks={false} label={tAudit("listLabel")} />
            )}
          </Panel>
        </div>

        <div className="flex min-w-0 flex-col gap-section">
          <Panel id="details-heading" title={t("details.title")} icon={Building2}>
            <dl className="grid gap-3 text-sm">
              <Detail label={t("details.slug")}>
                <code translate="no" className="font-mono font-bold">
                  {operator.slug}
                </code>
                <span className="block text-caption text-muted">{t("details.slugHint")}</span>
              </Detail>
              <Detail label={t("details.tz")}>{timeZoneLabel(operator.tz, locale)}</Detail>
              <Detail label={t("details.numbers")}>
                {t("details.numbersValue", {
                  stores: operator.stores,
                  people: operator.people,
                  owners: operator.owners,
                })}
              </Detail>
              <Detail label={t("details.created")}>{when(format, operator.created_at)}</Detail>
              <Detail label={t("details.activity")}>
                <Ago format={format} iso={operator.last_activity_at} now={now} never={tOverview("operators.never")} />
              </Detail>
              <Detail label={t("details.logo")}>
                {operator.logo_url ? (
                  <span translate="no" className="break-all">
                    {operator.logo_url}
                  </span>
                ) : (
                  <span className="text-muted">{t("details.noLogo")}</span>
                )}
              </Detail>
            </dl>
            <details className="group mt-1 border-t border-border pt-2">
              <summary
                className={`inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-compact text-sm font-extrabold text-brand-ink [&::-webkit-details-marker]:hidden ${ringInside}`}
              >
                {t("details.addressSteps")}
              </summary>
              <div className="pt-1">
                <AddressSetup slug={operator.slug} portalUrl={operator.portal_url} />
              </div>
            </details>
          </Panel>

          <Panel id="danger-heading" title={t("danger.title")} icon={ShieldAlert}>
            <p className="text-sm text-muted">
              {operator.status === "active" ? t("danger.activeLead") : t("danger.suspendedLead")}
            </p>
            {canWrite ? (
              <div>
                <OperatorStatusAction operator={operator} />
              </div>
            ) : (
              <p className="text-caption text-muted">{t("danger.noPermission")}</p>
            )}
          </Panel>
        </div>
      </Columns>
    </>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-extrabold text-muted">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold">{children}</dd>
    </div>
  );
}
