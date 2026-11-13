import type { Schemas } from "@crewstars/api-client";
import { ChevronDown, ChevronRight, Coins, Gift, Hourglass, Info, MessageCircle, Store, Users } from "lucide-react";
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
  Columns,
  cx,
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
type Unrecognized = Schemas["UnrecognizedOut"];

/** How many of the crew not yet recognized are listed before "Show N more": enough to act on
 *  at a glance, without a list inside the page that scrolls on its own. */
const FIRST_UNRECOGNIZED = 6;

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
 * them, redemptions included: coins redeemed, requests waiting and each store's budget used
 * come from the reward requests (P3).
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
      // The first to give way on a narrow full table: the store cards on Stores & people
      // name every GM too.
      hideBelow: "md",
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
        <div className="grid grid-cols-2 gap-tile @2xl/page:grid-cols-3 @4xl/page:grid-cols-5">
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
            className="col-span-2 @2xl/page:col-span-1"
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

      <Columns layout="halves" align="stretch">
        <Panel
          id="not-recognized-heading"
          title={tr("overview.notRecognized", { month, count: overview.not_recognized.length })}
          icon={Info}
          lead={tr("overview.notRecognizedLead")}
        >
          {overview.not_recognized.length === 0 ? (
            <p className="text-sm text-muted">{tr("overview.everyoneRecognized")}</p>
          ) : (
            <UnrecognizedList
              people={overview.not_recognized}
              storeName={(number) => tr("store", { number })}
              days={(days) => tr("overview.daysOnTeam", { days })}
              recognize={tr("recognizeAction")}
              more={(count) => tr("overview.showMore", { count })}
              fewer={tr("overview.showFewer")}
            />
          )}
        </Panel>

        <Panel id="recent-heading" title={tr("overview.recent")} icon={MessageCircle}>
          {overview.recent.length === 0 ? (
            <p className="text-sm text-muted">{tr("overview.noRecent")}</p>
          ) : (
            <PostFeed posts={overview.recent} now={now} hide label={tr("overview.recent")} />
          )}
        </Panel>
      </Columns>
    </>
  );
}

/**
 * The crew not recognized yet this month (OP-04), each with a Recognize button: the first few,
 * then the rest behind "Show N more", a native disclosure that opens from the keyboard and
 * needs no script. The whole list used to scroll inside its card, a scroller inside the page's
 * own that trapped the wheel and, on a phone, the thumb.
 */
function UnrecognizedList({
  people,
  storeName,
  days,
  recognize,
  more,
  fewer,
}: {
  people: readonly Unrecognized[];
  storeName: (number: string) => string;
  days: (days: number) => string;
  recognize: string;
  more: (count: number) => string;
  fewer: string;
}) {
  const first = people.slice(0, FIRST_UNRECOGNIZED);
  const rest = people.slice(FIRST_UNRECOGNIZED);
  const row = (person: Unrecognized, last: boolean) => (
    <li
      key={person.id}
      className={cx("flex items-center gap-3 border-b border-border py-2.5", last && "last:border-b-0 last:pb-0")}
    >
      <Avatar name={person.name} colored seed={person.id} className="size-8.5 text-caption" />
      <div className="min-w-0 flex-1">
        <p className="break-words font-extrabold">{person.name}</p>
        <p className="text-caption text-muted">
          {[person.store ? storeName(person.store.number) : null, person.days_on_team !== null ? days(person.days_on_team) : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <Link
        href={`/recognize${withQuery({}, { to: person.id })}`}
        className={buttonClass({ variant: "secondary", size: "console" })}
      >
        {recognize}
        <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
      </Link>
    </li>
  );
  return (
    <div className="-mt-2.5 flex flex-col">
      <ul className="flex flex-col">{first.map((person) => row(person, rest.length === 0))}</ul>
      {rest.length > 0 ? (
        <details className="group">
          <summary
            className={cx(
              "inline-flex min-h-11 cursor-pointer list-none select-none items-center gap-1.5 rounded-compact pr-1 text-sm font-extrabold text-brand-ink",
              "[&::-webkit-details-marker]:hidden",
            )}
          >
            <ChevronDown
              aria-hidden="true"
              className="size-4 shrink-0 transition-transform duration-fast group-open:rotate-180"
              strokeWidth={2.4}
            />
            <span className="group-open:hidden">{more(rest.length)}</span>
            <span className="hidden group-open:inline">{fewer}</span>
          </summary>
          <ul className="flex flex-col border-t border-border">{rest.map((person) => row(person, true))}</ul>
        </details>
      ) : null}
    </div>
  );
}
