import type { Schemas } from "@crewstars/api-client";
import { ChartColumn, FileDown, ListChecks } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { CoinPill } from "@/components/recognition/Chips";
import { coinsToUsd, formatCount, formatUsd } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { StoreFilter } from "@/components/recognition/StoreFilter";
import { defaultPayrollMonth, recentMonths } from "@/components/redemptions/payroll";
import { PayrollExport } from "@/components/redemptions/PayrollExport";
import {
  actionsFor,
  deciderOf,
  REQUESTS_PAGE_SIZE,
  redemptionsApiQuery,
  redemptionsState,
  TABS,
  tabHasActions,
  tabHref,
  type RedemptionTab,
} from "@/components/redemptions/redemptions-query";
import { RequestActions } from "@/components/redemptions/RequestActions";
import { localName } from "@/components/rewards/reward-form";
import { RewardIcon } from "@/components/rewards/RewardIcon";
import { lastPageOffset } from "@/components/roster/roster-query";
import { RoleChip } from "@/components/roster/RosterBits";
import {
  Alert,
  Avatar,
  Badge,
  cx,
  DataTable,
  EmptyState,
  PageHeader,
  Progress,
  StatusPill,
  TablePager,
  Tabs,
  withQuery,
  type Column,
  type PillStatus,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";
import { findStore, storeHref, storeParam } from "@/lib/store-scope";

export function generateMetadata() {
  return portalMetadata("redemptions");
}

type RequestRow = Schemas["RequestRow"];
type StoreBudget = Schemas["StoreBudgetOut"];

const PILL: Record<RequestRow["status"], PillStatus> = {
  pending: "pending",
  approved: "approved",
  collected: "collected",
  declined: "declined",
  cancelled: "declined",
};

/**
 * Redemptions (OP-09, plan G4): each store's reward budget this month as a bar, then every
 * reward request with Waiting / Approved / Declined / All tabs and their counts, who decided
 * each one, and the owner's own Approve, Decline and Mark collected; then the payroll export.
 *
 * Everything is read here on the server, in one call to GET /portal/redemptions after the
 * store in the URL (the shared filter, OP-01) is matched to its id. The tab and the page are
 * the URL's too. The actions are the one client piece; each redraws the page when it is done.
 */
export default async function RedemptionsPage({ searchParams }: PageProps<"/redemptions">) {
  const query = (await searchParams) as Query;
  const param = storeParam(query);
  const state = redemptionsState(query);
  const here = `/redemptions${withQuery(query, {})}`;
  const now = new Date();
  const [t, tPage, tr, te, format, locale] = await Promise.all([
    getTranslations("redemptions"),
    getTranslations("pages.redemptions"),
    getTranslations("recognition"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [stores, settings] = await Promise.all([
      api.GET("/api/v1/portal/stores").then(body),
      // Only for the budget's dollars: the page stands without it.
      api
        .GET("/api/v1/portal/settings")
        .then(body)
        .catch(() => null),
    ]);
    const store = findStore(param, stores);
    const data = body(
      await api.GET("/api/v1/portal/redemptions", { params: { query: redemptionsApiQuery(state, store?.id) } }),
    );
    return { stores, store, data, coinValue: settings?.rules.coin_value ?? null };
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

  const { stores, store, data, coinValue } = loaded.data;
  // A page past the end (a decision shrank the tab, a bookmark aged) shows the last one.
  const last = lastPageOffset(state.offset, data.total, REQUESTS_PAGE_SIZE);
  if (last !== null) redirect(`/redemptions${withQuery(query, { offset: last || null })}`);

  const count = (value: number) => formatCount(value, locale);
  const budget = data.budgets[0]?.budget ?? null;
  const month = defaultPayrollMonth(
    data.budgets.map((row) => row.month),
    now,
  );
  const when = (iso: string) => {
    const at = new Date(iso);
    return (
      <time dateTime={iso} title={format.dateTime(at, { dateStyle: "medium", timeStyle: "short" })}>
        {format.relativeTime(at, now)}
      </time>
    );
  };

  const statusText = (row: RequestRow) => t(`requests.status.${row.status}`);
  const columns: Column<RequestRow>[] = [
    {
      key: "person",
      header: t("requests.columns.person"),
      overflow: "wrap",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={row.person.name} colored seed={row.person.id} className="size-8 text-caption" />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-extrabold">{row.person.name}</span>
            {row.person.role !== "crew" && row.person.role !== "owner" ? <RoleChip role={row.person.role} /> : null}
          </span>
        </span>
      ),
    },
    {
      key: "store",
      header: t("requests.columns.store"),
      overflow: "nowrap",
      // On a narrow full table the store goes first (the page's store filter says which one
      // is shown), then when it was asked; the cards still show both.
      hideBelow: "md",
      cell: (row) =>
        row.store ? (
          <>
            <span className="font-bold tabular-nums">{row.store.number}</span>
            <span className="block text-caption text-muted">{row.store.name}</span>
          </>
        ) : (
          <span className="text-caption text-muted">{t("requests.noStore")}</span>
        ),
    },
    {
      key: "reward",
      header: t("requests.columns.reward"),
      overflow: "wrap",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <RewardIcon icon={row.icon} size="sm" />
          <span className="flex min-w-0 flex-col items-start gap-1">
            <span className="font-bold">{localName(row, locale)}</span>
            {row.source === "spin" ? <Badge tone="reward">{t("requests.spin")}</Badge> : null}
          </span>
        </span>
      ),
    },
    {
      key: "coins",
      header: t("requests.columns.coins"),
      align: "end",
      cell: (row) => <CoinPill coins={row.cost} />,
    },
    {
      key: "requested",
      header: t("requests.columns.requested"),
      overflow: "nowrap",
      hideBelow: "lg",
      cell: (row) => <span className="text-caption text-muted">{when(row.created_at)}</span>,
    },
    {
      key: "status",
      header: t("requests.columns.status"),
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          <StatusPill status={PILL[row.status]}>{statusText(row)}</StatusPill>
          {row.status === "pending" ? (
            <span className="whitespace-nowrap text-caption text-muted">{t(`requests.approver.${row.approver}`)}</span>
          ) : null}
        </span>
      ),
    },
  ];
  if (state.tab !== "pending") {
    columns.push({
      key: "decided",
      header: t("requests.columns.decided"),
      overflow: "wrap",
      cell: (row) => {
        const decider = deciderOf(row);
        if (!decider) return <span className="text-caption text-muted">{t("requests.notDecided")}</span>;
        const name =
          decider.kind === "automatic"
            ? t("requests.decider.automatic")
            : (decider.name ??
              (decider.kind === "owner" ? t("requests.decider.ownerUnnamed") : t("requests.decider.managerUnnamed")));
        const role =
          decider.kind === "automatic"
            ? t("requests.decider.automaticHint")
            : decider.kind === "owner"
              ? t("requests.decider.owner")
              : t("requests.decider.manager");
        return (
          <>
            <span className="block font-bold">{name}</span>
            <span className="block text-caption text-muted">
              {role}
              {row.decided_at ? <> · {when(row.decided_at)}</> : null}
            </span>
          </>
        );
      },
    });
  }
  if (tabHasActions(state.tab)) {
    columns.push({
      key: "actions",
      header: t("requests.columns.actions"),
      width: "min",
      pin: "end",
      cell: (row) =>
        actionsFor(row.status).length > 0 ? (
          <RequestActions
            id={row.id}
            status={row.status}
            person={row.person.name}
            reward={localName(row, locale)}
            coins={row.cost}
          />
        ) : null,
    });
  }

  const tabs = TABS.map((tab) => ({
    key: tab,
    label: t(`requests.tabs.${tab}`),
    href: tabHref(query, tab),
    count: data.counts[tab],
  }));
  const empty: Record<RedemptionTab, [string, string]> = {
    pending: [t("requests.empty.pending"), t("requests.empty.pendingLead")],
    approved: [t("requests.empty.approved"), t("requests.empty.approvedLead")],
    declined: [t("requests.empty.declined"), t("requests.empty.declinedLead")],
    all: [t("requests.empty.all"), t("requests.empty.allLead")],
  };

  return (
    <>
      <PageHeader
        title={tPage("title")}
        lead={tPage("lead")}
        action={<StoreFilter stores={stores} selected={store} className="sm:w-64" />}
      />

      <Panel
        id="budgets-heading"
        title={t("budgets.heading")}
        icon={ChartColumn}
        lead={
          budget !== null
            ? t.rich(coinValue !== null ? "budgets.lead" : "budgets.leadNoRate", {
                budget: count(budget),
                usd: formatUsd(coinsToUsd(budget, coinValue ?? 0), locale),
                link: (chunks) => (
                  <Link href="/coins" className="font-bold text-brand-ink underline underline-offset-2">
                    {chunks}
                  </Link>
                ),
              })
            : undefined
        }
      >
        {data.budgets.length === 0 ? (
          <p className="text-sm text-muted">{t("budgets.none")}</p>
        ) : (
          // Two stores to a line on a wide page, so a bar is not stretched across the screen.
          <ul className="grid gap-x-10 gap-y-3 @6xl/page:grid-cols-2">
            {data.budgets.map((row) => (
              <BudgetRow
                key={row.store.id}
                row={row}
                href={store ? null : storeHref("/redemptions", query, row.store.number)}
                label={tr("store", { number: row.store.number })}
                bar={t("budgets.bar", { number: row.store.number })}
                value={t("budgets.value", { used: count(row.used), budget: count(row.budget) })}
                over={t("budgets.over")}
              />
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        id="requests-heading"
        title={t("requests.heading")}
        icon={ListChecks}
        flush
        action={<Tabs items={tabs} current={state.tab} label={t("requests.tabsLabel")} />}
      >
        {data.total === 0 ? (
          <div className="px-4.5 pb-4.5">
            <EmptyState title={empty[state.tab][0]} lead={empty[state.tab][1]} />
          </div>
        ) : (
          <>
            <DataTable
              caption={t("requests.caption")}
              columns={columns}
              rows={data.items}
              rowKey={(row) => row.id}
              bare
              className="border-t border-border"
            />
            <TablePager
              query={query}
              className="px-4.5 pb-4.5"
              page={{ rows: data.items, offset: state.offset, size: REQUESTS_PAGE_SIZE, total: data.total }}
            />
          </>
        )}
      </Panel>

      <Panel id="payroll-heading" title={t("payroll.heading")} icon={FileDown} lead={t("payroll.lead")}>
        <PayrollExport months={recentMonths(month)} initial={month} />
      </Panel>
    </>
  );
}

/** One store's budget this month: its name (a link that filters to it), the bar, and the
 *  figure, which turns to words when the store has gone over. On a phone the name and the
 *  figure share a line and the bar runs under them. */
function BudgetRow({
  row,
  href,
  label,
  bar,
  value,
  over,
}: {
  row: StoreBudget;
  href: string | null;
  label: string;
  bar: string;
  value: string;
  over: string;
}) {
  const overBudget = row.budget > 0 && row.used > row.budget;
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 sm:grid-cols-[11rem_minmax(0,1fr)_10rem]">
      <span className="min-w-0 break-words">
        {href ? (
          <Link href={href} className={cx("font-extrabold underline-offset-2 hover:underline", ringInside)}>
            {label}
          </Link>
        ) : (
          <b className="font-extrabold">{label}</b>
        )}{" "}
        <span className="text-caption text-muted">{row.store.name}</span>
      </span>
      <Progress
        label={bar}
        value={Math.max(0, Math.min(row.used, row.budget))}
        max={row.budget}
        tone={overBudget ? "danger" : "brand"}
        className="order-last col-span-2 sm:order-none sm:col-span-1"
      />
      <span className={cx("text-right text-caption tabular-nums", overBudget && "font-bold text-danger-ink")}>
        {value}
        {overBudget ? ` (${over})` : ""}
      </span>
    </li>
  );
}
