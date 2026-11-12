import type { Schemas } from "@crewstars/api-client";
import { ChevronRight, Coins, Gift, Hourglass, Info, MessageCircle, Store, Users } from "lucide-react";
import Link from "next/link";
import { getFormatter, getLocale, getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { Meter } from "@/components/recognition/Meter";
import { formatCount, formatUsd, percent } from "@/components/recognition/numbers";
import { Panel } from "@/components/recognition/Panel";
import { PostFeed } from "@/components/recognition/PostFeed";
import { RowLinks } from "@/components/recognition/RowLinks";
import { StoreFilter } from "@/components/recognition/StoreFilter";
import {
  Alert,
  Avatar,
  Badge,
  buttonClass,
  DataTable,
  EmptyState,
  PageHeader,
  StatTile,
  VisuallyHidden,
  withQuery,
  type Column,
  type Query,
} from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { loadOwner } from "@/lib/me";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";
import { findStore, hrefWithStore, storeHref, storeParam } from "@/lib/store-scope";

export function generateMetadata() {
  return portalMetadata("overview");
}

type StoreRow = Schemas["StoreRow"];

/** The month the API reports ("2026-11") as a date to name it by, read in UTC. */
function monthDate(month: string, fallback: Date): Date {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)) : fallback;
}

/**
 * Overview (OP-01 to OP-05): this month across the stores, or one store - the KPI tiles, the
 * by-store table (a row filters to its store), the crew nobody has recognized yet, and the
 * latest shout-outs, each of which the owner can hide.
 *
 * Everything is read here on the server, in one call to GET /portal/overview, after the store
 * in the URL is matched to its id. The numbers are the API's (plan D6); this page only draws
 * them. Redemptions are 0 until they are built (P3), but the tiles are already here.
 */
export default async function OverviewPage({ searchParams }: PageProps<"/">) {
  const query = (await searchParams) as Query;
  const param = storeParam(query);
  const here = `/${withQuery(query, {})}`;
  const now = new Date();
  const [owner, t, tr, te, format, locale] = await Promise.all([
    loadOwner(),
    getTranslations("pages.overview"),
    getTranslations("recognition"),
    getTranslations("errors"),
    getFormatter(),
    getLocale(),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    const [stores, settings] = await Promise.all([
      api.GET("/api/v1/portal/stores").then(body),
      // Only for "at $0.10 a coin" under the dollars: the page stands without it.
      api
        .GET("/api/v1/portal/settings")
        .then(body)
        .catch(() => null),
    ]);
    const store = findStore(param, stores);
    const overview = body(
      await api.GET("/api/v1/portal/overview", { params: { query: store ? { store: store.id } : {} } }),
    );
    return { stores, store, overview, coinValue: settings?.rules.coin_value ?? null };
  });

  const month = format.dateTime(monthDate(loaded.ok ? loaded.data.overview.month : "", now), {
    month: "long",
    timeZone: "UTC",
  });
  const title = owner ? t("title", { name: owner.firstName, month }) : t("titleNoName", { month });

  if (!loaded.ok) {
    return (
      <>
        <PageHeader title={title} lead={t("lead")} />
        <Alert kind="error">
          {tr("loadError")} {te.has(loaded.code) ? te(loaded.code) : te("generic")}{" "}
          <Link href={here} className="font-extrabold underline underline-offset-2">
            {tr("retry")}
          </Link>
        </Alert>
      </>
    );
  }

  const { stores, store, overview, coinValue } = loaded.data;
  const { stats } = overview;
  const count = (value: number) => formatCount(value, locale);
  const usd = (value: number) => formatUsd(value, locale);
  const scope = store?.number ?? null;

  const columns: Column<StoreRow>[] = [
    {
      key: "store",
      header: tr("overview.columns.store"),
      overflow: "wrap",
      cell: (row) => (
        <>
          <Link
            href={storeHref("/", query, row.store.number)}
            data-row-link
            className={`font-extrabold text-foreground underline-offset-2 hover:underline ${ringInside}`}
          >
            {tr("store", { number: row.store.number })}
          </Link>
          <span className="block text-caption text-muted">{row.store.name}</span>
        </>
      ),
    },
    {
      key: "gm",
      header: tr("overview.columns.gm"),
      overflow: "wrap",
      cell: (row) => row.gm?.name ?? <span className="text-muted">{tr("overview.noGm")}</span>,
    },
    {
      key: "recognized",
      header: tr("overview.columns.recognized"),
      cell: (row) => (
        <Meter
          label={tr("overview.recognizedBar", { number: row.store.number })}
          value={row.crew_recognized}
          max={row.crew_total}
          tone="success"
          text={
            <>
              <b className="font-black">{tr("percent", { value: percent(row.crew_recognized, row.crew_total) })}</b>{" "}
              {tr("overview.ofCrew", { recognized: row.crew_recognized, total: row.crew_total })}
            </>
          }
        />
      ),
    },
    {
      key: "earned",
      header: tr("overview.columns.earned"),
      align: "end",
      cell: (row) => <b className="font-black">{count(row.coins_earned)}</b>,
    },
    {
      key: "budget",
      header: tr("overview.columns.budget"),
      cell: (row) => (
        <Meter
          label={tr("overview.budgetBar", { number: row.store.number })}
          value={row.budget_used}
          max={row.budget}
          tone={row.budget > 0 && row.budget_used > row.budget ? "danger" : "brand"}
          text={tr("overview.budgetValue", { used: count(row.budget_used), budget: count(row.budget) })}
        />
      ),
    },
    {
      key: "waiting",
      header: tr("overview.columns.waiting"),
      align: "end",
      cell: (row) =>
        row.requests_waiting > 0 ? <Badge tone="warning">{count(row.requests_waiting)}</Badge> : <span>0</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title={title}
        lead={t("lead")}
        action={<StoreFilter stores={stores} selected={store} className="sm:w-64" />}
      />

      <section aria-labelledby="kpi-heading">
        <h2 id="kpi-heading" className="sr-only">
          {tr("overview.statsLabel", { month })}
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <StatTile
            label={tr("overview.shoutouts")}
            value={count(stats.shoutouts)}
            hint={tr("overview.shoutoutsHint")}
            icon={<MessageCircle className="size-4.5" strokeWidth={2.2} />}
            tone="brand"
          />
          <StatTile
            label={tr("overview.recognized")}
            value={tr("percent", { value: percent(stats.crew_recognized, stats.crew_total) })}
            hint={tr("overview.recognizedHint", {
              recognized: count(stats.crew_recognized),
              total: count(stats.crew_total),
            })}
            icon={<Users className="size-4.5" strokeWidth={2.2} />}
            tone="success"
          />
          <StatTile
            label={tr("overview.earned")}
            value={count(stats.coins_earned)}
            hint={
              coinValue !== null
                ? tr("overview.earnedHint", { usd: usd(stats.coins_earned_usd), rate: usd(coinValue) })
                : tr("overview.earnedHintNoRate", { usd: usd(stats.coins_earned_usd) })
            }
            icon={<Coins className="size-4.5" strokeWidth={2.2} />}
            tone="warning"
          />
          <StatTile
            label={tr("overview.redeemed")}
            value={count(stats.coins_redeemed)}
            hint={tr("overview.redeemedHint", { usd: usd(stats.coins_redeemed_usd) })}
            icon={<Gift className="size-4.5" strokeWidth={2.2} />}
            tone="reward"
          />
          <StatTile
            label={tr("overview.waiting")}
            value={
              <span className={stats.requests_waiting > 0 ? "text-brand-ink" : undefined}>
                {count(stats.requests_waiting)}
              </span>
            }
            hint={
              <span className="inline-flex items-center gap-0.5 font-bold">
                {tr("overview.waitingHint")}
                <ChevronRight aria-hidden="true" className="size-3.5" strokeWidth={2.4} />
              </span>
            }
            icon={<Hourglass className="size-4.5" strokeWidth={2.2} />}
            tone="danger"
            href={hrefWithStore("/redemptions", scope)}
            className="col-span-2 md:col-span-1"
          />
        </div>
      </section>

      <Panel id="by-store-heading" title={tr("overview.byStore")} icon={Store} flush>
        {overview.stores.length === 0 ? (
          <div className="px-4.5 pb-4.5">
            <EmptyState title={tr("overview.noStores")} />
          </div>
        ) : (
          <RowLinks>
            <DataTable
              caption={tr("overview.storeCaption")}
              columns={columns}
              rows={overview.stores}
              rowKey={(row) => row.store.id}
              bare
              className="border-t border-border"
            />
          </RowLinks>
        )}
      </Panel>

      <div className="grid items-start gap-4.5 lg:grid-cols-2">
        <Panel
          id="not-recognized-heading"
          title={tr("overview.notRecognized", { month, count: overview.not_recognized.length })}
          icon={Info}
          lead={tr("overview.notRecognizedLead")}
        >
          {overview.not_recognized.length === 0 ? (
            <p className="text-sm text-muted">{tr("overview.everyoneRecognized")}</p>
          ) : (
            <ul className="-mx-1 flex max-h-112 flex-col overflow-y-auto px-1">
              {overview.not_recognized.map((person) => (
                <li
                  key={person.id}
                  className="flex items-center gap-3 border-b border-border py-2.5 first:pt-0 last:border-b-0"
                >
                  <Avatar name={person.name} colored seed={person.id} className="size-8.5 text-caption" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-extrabold">{person.name}</p>
                    <p className="text-caption text-muted">
                      {[
                        person.store ? tr("store", { number: person.store.number }) : null,
                        person.days_on_team !== null
                          ? tr("overview.daysOnTeam", { days: person.days_on_team })
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Link
                    href={`/recognize${withQuery({}, { to: person.id })}`}
                    className={buttonClass({ variant: "secondary", size: "console" })}
                  >
                    {tr("recognizeAction")}
                    <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel id="recent-heading" title={tr("overview.recent")} icon={MessageCircle}>
          {overview.recent.length === 0 ? (
            <p className="text-sm text-muted">{tr("overview.noRecent")}</p>
          ) : (
            <PostFeed posts={overview.recent} now={now} hide label={tr("overview.recent")} />
          )}
        </Panel>
      </div>
    </>
  );
}
