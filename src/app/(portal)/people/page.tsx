import type { Schemas } from "@crewstars/api-client";
import { Users } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { TierChip } from "@/components/recognition/Chips";
import { Meter } from "@/components/recognition/Meter";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { QuerySearch, QuerySelect } from "@/components/recognition/QueryControls";
import {
  ROLES,
  TEAM_PAGE_SIZE,
  teamApiQuery,
  teamFilters,
} from "@/components/recognition/recognition-query";
import { StoreFilter } from "@/components/recognition/StoreFilter";
import { lastPageOffset } from "@/components/roster/roster-query";
import { RoleChip } from "@/components/roster/RosterBits";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  cx,
  DataTable,
  EmptyState,
  PageHeader,
  TablePager,
  VisuallyHidden,
  withQuery,
  type Column,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";
import { findStore, storeHref, storeParam } from "@/lib/store-scope";

export function generateMetadata() {
  return portalMetadata("people");
}

type StoreRow = Schemas["StoreRow"];
type TeamRow = Schemas["TeamRow"];

/**
 * Stores & people (OP-08): a card per store (its GM and supervisor, crew recognized, reward
 * budget used), then everyone in the program with this month's numbers, filtered by the
 * shared store filter, a role and a name, a page at a time. Every row has a Recognize button.
 *
 * All of it is one read of GET /portal/team on the server; the filters and the pager are the
 * URL's.
 */
export default async function PeoplePage({ searchParams }: PageProps<"/people">) {
  const query = (await searchParams) as Query;
  const param = storeParam(query);
  const filters = teamFilters(query);
  const here = `/people${withQuery(query, {})}`;
  const [t, tPage, tr, tRoles, te, locale] = await Promise.all([
    getTranslations("recognition.people"),
    getTranslations("pages.people"),
    getTranslations("recognition"),
    getTranslations("roster.roles"),
    getTranslations("errors"),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const stores = body(await api.GET("/api/v1/portal/stores"));
    const store = findStore(param, stores);
    const team = body(await api.GET("/api/v1/portal/team", { params: { query: teamApiQuery(filters, store?.id) } }));
    return { stores, store, team };
  });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={tPage("title")} lead={tPage("lead")} />
        <Alert kind="error">
          {tr("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {tr("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { stores, store, team } = loaded.data;
  // A page past the end (a filter shrank the list, a bookmark aged) shows the last one.
  const last = lastPageOffset(filters.offset, team.total, TEAM_PAGE_SIZE);
  if (last !== null) redirect(`/people${withQuery(query, { offset: last || null })}`);

  const count = (value: number) => formatCount(value, locale);
  const filtered = Boolean(filters.role || filters.q);

  const columns: Column<TeamRow>[] = [
    {
      key: "name",
      header: t("columns.name"),
      overflow: "wrap",
      cell: (person) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={person.name} colored seed={person.id} className="size-8 text-caption" />
          <span className="font-extrabold">{person.name}</span>
        </span>
      ),
    },
    { key: "role", header: t("columns.role"), cell: (person) => <RoleChip role={person.role} /> },
    {
      key: "store",
      header: t("columns.store"),
      overflow: "wrap",
      cell: (person) =>
        person.store ? (
          <span className="text-caption">
            <span className="font-bold tabular-nums">{person.store.number}</span> · {person.store.name}
          </span>
        ) : person.stores.length > 0 ? (
          // A supervisor covers several stores.
          <span
            className="text-caption"
            title={person.stores.map((store) => `${store.number} · ${store.name}`).join(", ")}
          >
            {t("stores", { list: person.stores.map((store) => store.number).join(", ") })}
          </span>
        ) : person.area ? (
          <span className="text-caption">{person.area.name}</span>
        ) : (
          <span className="text-caption text-muted">{t("nowhere")}</span>
        ),
    },
    {
      key: "balance",
      header: t("columns.balance"),
      align: "end",
      cell: (person) => <b className="font-black">{count(person.balance)}</b>,
    },
    {
      key: "month",
      header: t("columns.month"),
      align: "end",
      cell: (person) =>
        person.earned_this_month > 0 ? (
          count(person.earned_this_month)
        ) : (
          // Nobody has recognized them this month: worth noticing, in words as well as colour.
          <Badge tone="warning">
            0<VisuallyHidden>{` ${t("noneYet")}`}</VisuallyHidden>
          </Badge>
        ),
    },
    // On a narrower table the tier, kudos and badges give way first: the month's coins and the
    // balance are what an owner acts on here.
    { key: "tier", header: t("columns.tier"), hideBelow: "md", cell: (person) => <TierChip tier={person.tier} /> },
    {
      key: "kudos",
      header: t("columns.kudos"),
      align: "end",
      overflow: "nowrap",
      hideBelow: "lg",
      cell: (person) =>
        t("kudosValue", { left: count(person.kudos_left), allowance: count(person.kudos_allowance) }),
    },
    { key: "badges", header: t("columns.badges"), align: "end", hideBelow: "lg", cell: (person) => count(person.badges) },
    {
      key: "actions",
      header: t("columns.actions"),
      width: "min",
      pin: "end",
      cell: (person) => (
        <Link
          href={`/recognize${withQuery({}, { to: person.id })}`}
          className={buttonClass({ variant: "secondary", size: "console" })}
        >
          {tr("recognizeAction")}
          <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
        </Link>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={tPage("title")}
        lead={tPage("lead")}
        action={<StoreFilter stores={stores} selected={store} className="sm:w-64" />}
      />

      <section aria-labelledby="stores-heading">
        <h2 id="stores-heading" className="sr-only">
          {t("storesHeading")}
        </h2>
        {team.stores.length === 0 ? (
          <EmptyState title={tr("overview.noStores")} />
        ) : (
          // As many cards to a row as fit at 208px or more, sharing the row between them.
          <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,13rem),1fr))] gap-tile">
            {team.stores.map((row) => (
              <StoreCard key={row.store.id} row={row} href={store ? null : storeHref("/people", query, row.store.number)} />
            ))}
          </ul>
        )}
      </section>

      <Panel
        id="people-heading"
        title={t("heading", { count: team.total })}
        icon={Users}
        flush
        action={
          <div className="flex w-full flex-wrap items-end gap-3 sm:w-auto">
            <QuerySelect
              label={t("filters.role")}
              param="role"
              value={filters.role ?? ""}
              className="sm:w-44"
              options={[
                { value: "", label: t("filters.anyRole") },
                ...ROLES.map((role) => ({ value: role, label: tRoles(role) })),
              ]}
            />
            <QuerySearch
              label={t("filters.search")}
              value={filters.q ?? ""}
              placeholder={t("filters.searchPlaceholder")}
              className="sm:w-56"
            />
          </div>
        }
      >
        {team.total === 0 && !filtered ? (
          <div className="px-4.5 pb-4.5">
            <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
          </div>
        ) : (
          <>
            <DataTable
              caption={t("caption")}
              columns={columns}
              rows={team.people}
              rowKey={(person) => person.id}
              bare
              className="border-t border-border"
              empty={
                <p className="text-sm text-muted">
                  {t("noMatch")}{" "}
                  <Link
                    href={`/people${withQuery({ store: store?.number }, {})}`}
                    className="font-extrabold text-brand-ink underline underline-offset-2"
                  >
                    {t("clearFilters")}
                  </Link>
                </p>
              }
            />
            <TablePager
              query={query}
              className="px-4.5 pb-4.5"
              page={{ rows: team.people, offset: filters.offset, size: TEAM_PAGE_SIZE, total: team.total }}
            />
          </>
        )}
      </Panel>
    </>
  );
}

/** One store's card: GM and supervisor, crew recognized and reward budget used, each as a
 *  figure and a bar. With `href`, its heading is a link that filters the page to the store,
 *  stretched over the whole card. */
async function StoreCard({ row, href }: { row: StoreRow; href: string | null }) {
  const [t, tr, locale] = await Promise.all([
    getTranslations("recognition.people.card"),
    getTranslations("recognition"),
    getLocale(),
  ]);
  const count = (value: number) => formatCount(value, locale);
  const over = row.budget > 0 && row.budget_used > row.budget;
  const name = tr("store", { number: row.store.number });
  return (
    <li className="relative flex flex-col gap-2 rounded-2xl border border-border bg-surface-raised p-3.5 has-[a:hover]:border-brand">
      <h3 className="flex flex-wrap items-baseline justify-between gap-x-2 text-body font-black tracking-normal">
        {href ? (
          <Link
            href={href}
            className={cx("after:absolute after:inset-0 after:rounded-2xl after:content-['']", ringInside)}
          >
            {name}
          </Link>
        ) : (
          name
        )}
        <span className="text-caption font-semibold text-muted">{row.store.name}</span>
      </h3>
      <p className="text-caption text-muted">
        {t("gm", { name: row.gm?.name ?? t("nobody") })} · {t("supervisor", { name: row.supervisor?.name ?? t("nobody") })}
      </p>
      <div className="flex justify-between gap-2 text-caption">
        <span>{t("recognized")}</span>
        <b className="font-black tabular-nums">{`${count(row.crew_recognized)}/${count(row.crew_total)}`}</b>
      </div>
      <Meter
        layout="stacked"
        label={tr("overview.recognizedBar", { number: row.store.number })}
        value={row.crew_recognized}
        max={row.crew_total}
        tone="success"
        text={null}
      />
      <div className="flex justify-between gap-2 text-caption">
        <span>{t("budget")}</span>
        <b className={cx("font-black tabular-nums", over && "text-danger-ink")}>
          {tr("overview.budgetValue", { used: count(row.budget_used), budget: count(row.budget) })}
          {over ? ` ${t("over")}` : ""}
        </b>
      </div>
      <Meter
        layout="stacked"
        label={tr("overview.budgetBar", { number: row.store.number })}
        value={row.budget_used}
        max={row.budget}
        tone={over ? "danger" : "brand"}
        text={null}
      />
    </li>
  );
}
