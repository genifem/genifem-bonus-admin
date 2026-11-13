import { Crown } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { AnnounceWinners } from "@/components/awards/AnnounceWinners";
import { AwardCategories } from "@/components/awards/AwardCategories";
import {
  announceState,
  metricUnit,
  monthDate,
  standing,
  type AwardCategory,
  type StoreAwards,
} from "@/components/awards/award-rules";
import { LiveNote } from "@/components/coins/LiveNote";
import { portalMetadata } from "@/components/console/PortalPage";
import { formatCount } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { StoreFilter } from "@/components/recognition/StoreFilter";
import { localName } from "@/components/rewards/reward-form";
import { RoleChip } from "@/components/roster/RosterBits";
import {
  Alert,
  Avatar,
  Badge,
  cx,
  DataTable,
  EmptyState,
  PageHeader,
  withQuery,
  type Column,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { serverApi } from "@/lib/server-api";
import { body, settle, type Loaded } from "@/lib/server-load";
import { findStore, storeHref, storeParam } from "@/lib/store-scope";

export function generateMetadata() {
  return portalMetadata("awards");
}

/** The code of an error a read threw, for saying it in words. */
function codeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === "string" ? code : "generic";
}

/**
 * Monthly awards (OP-19, OP-20): the award categories with their prize coins, each on or off,
 * saving as the owner types (plan §9); then "Leading right now", each store's current leader
 * per category that is on, for all stores or the one in the URL (the shared filter, OP-01);
 * and "Announce winners now", which pays every store's winners at once, once a month.
 *
 * Read here on the server: the settings, the open stores (for the filter and the monthly
 * cost), and GET /portal/awards/leaders, for the store picked; when one is, the unfiltered
 * list is read too, because announcing covers every store and is off only once all of them
 * are announced. The leaders may fail without taking the categories with them.
 */
export default async function AwardsPage({ searchParams }: PageProps<"/awards">) {
  const query = (await searchParams) as Query;
  const param = storeParam(query);
  const here = `/awards${withQuery(query, {})}`;
  const [t, tPage, tc, tr, te, format, locale] = await Promise.all([
    getTranslations("awards"),
    getTranslations("pages.awards"),
    getTranslations("coins"),
    getTranslations("recognition"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [settings, stores] = await Promise.all([
      api.GET("/api/v1/portal/settings").then(body),
      api
        .GET("/api/v1/portal/stores")
        .then(body)
        .catch(() => null),
    ]);
    const store = stores ? findStore(param, stores) : undefined;
    const leadersOf = (id?: string): Promise<Loaded<{ stores: StoreAwards[] }>> =>
      api
        .GET("/api/v1/portal/awards/leaders", { params: { query: id ? { store: id } : {} } })
        .then(body)
        .then(
          (data) => ({ ok: true as const, data }),
          (err: unknown) => ({ ok: false as const, code: codeOf(err) }),
        );
    const [shown, everyone] = await Promise.all([leadersOf(store?.id), store ? leadersOf() : null]);
    return { settings, stores, store, leaders: shown, all: everyone ?? shown };
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

  const { settings, stores, store, leaders, all } = loaded.data;
  const { awards, coin_value } = settings.rules;
  const openStores = stores ? stores.filter((item) => item.active).length : null;

  const monthName = (month: string) => {
    const date = monthDate(month);
    return date ? format.dateTime(date, { month: "long" }) : month;
  };
  const announce = all.ok ? announceState(all.data.stores) : null;
  const announceButton =
    announce && announce.kind !== "none" ? (
      <AnnounceWinners
        month={monthName(announce.month)}
        done={
          announce.kind === "done"
            ? { when: announce.at ? format.dateTime(new Date(announce.at), { dateStyle: "medium" }) : null, by: announce.by }
            : null
        }
      />
    ) : null;

  const shownStores = leaders.ok ? leaders.data.stores : [];
  const categories: AwardCategory[] = shownStores[0]?.categories ?? [];
  const count = (value: number) => formatCount(value, locale);
  const valueText = (category: AwardCategory, value: number) => {
    const unit = metricUnit(category.metric);
    return unit === "coins"
      ? t("leaders.coins", { count: value, shown: count(value) })
      : unit === "jump"
        ? t("leaders.jump", { count: value, shown: count(value) })
        : t("leaders.shoutouts", { count: value, shown: count(value) });
  };

  const columns: Column<StoreAwards>[] = [
    {
      key: "store",
      header: t("leaders.columns.store"),
      overflow: "wrap",
      cell: (row) => (
        <span className="flex flex-col items-start gap-1">
          {store ? (
            <b className="font-extrabold">{tr("store", { number: row.store.number })}</b>
          ) : (
            <Link
              href={storeHref("/awards", query, row.store.number)}
              className={cx("font-extrabold underline-offset-2 hover:underline", ringInside)}
            >
              {tr("store", { number: row.store.number })}
            </Link>
          )}
          <span className="text-caption text-muted">{row.store.name}</span>
          {row.announced ? (
            <Badge tone="success">{t("leaders.announced")}</Badge>
          ) : null}
        </span>
      ),
    },
    ...categories.map(
      (category): Column<StoreAwards> => ({
        key: category.id,
        header: localName(category, locale),
        cell: (row) => {
          const entry = row.categories.find((item) => item.id === category.id);
          const shown = entry ? standing(entry) : null;
          if (!entry || !shown) return <span className="text-caption text-muted">{t("leaders.none")}</span>;
          return (
            <span className="flex items-center gap-2">
              <Avatar name={shown.person.name} colored seed={shown.person.id} className="size-8 text-caption" />
              <span className="flex min-w-0 flex-col items-start gap-0.5">
                <span className="font-bold">{shown.person.name}</span>
                <span className="text-caption text-muted tabular-nums">{valueText(entry, shown.person.value)}</span>
                <span className="flex flex-wrap gap-1">
                  {shown.won ? <Badge tone="reward">{t("leaders.winner")}</Badge> : null}
                  {shown.person.role !== "crew" ? <RoleChip role={shown.person.role} /> : null}
                </span>
              </span>
            </span>
          );
        },
      }),
    ),
  ];

  return (
    <>
      <PageHeader
        title={tPage("title")}
        lead={tPage("lead")}
        action={stores ? <StoreFilter stores={stores} selected={store} className="sm:w-64" /> : undefined}
      />
      <LiveNote>{tc("live")}</LiveNote>

      <AwardCategories awards={awards} coinValue={coin_value} storeCount={openStores} />

      <Panel
        id="leaders-heading"
        title={t("leaders.heading")}
        icon={Crown}
        lead={t("leaders.lead")}
        action={announceButton}
        flush
      >
        {!leaders.ok ? (
          <div className="px-4.5 pb-4.5">
            <Alert kind="error">
              {t("leaders.loadError")} {te.has(leaders.code) ? te(leaders.code) : te("generic")}{" "}
              <Link href={here} className="font-extrabold underline underline-offset-2">
                {t("retry")}
              </Link>
            </Alert>
          </div>
        ) : shownStores.length === 0 ? (
          <div className="px-4.5 pb-4.5">
            <EmptyState title={t("leaders.noStores")} lead={t("leaders.noStoresLead")} />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-4.5 pb-4.5">
            <EmptyState title={t("leaders.allOff")} lead={t("leaders.allOffLead")} />
          </div>
        ) : (
          <DataTable
            caption={t("leaders.caption")}
            columns={columns}
            rows={shownStores}
            rowKey={(row) => row.store.id}
            bare
            className="border-t border-border"
          />
        )}
      </Panel>
    </>
  );
}
