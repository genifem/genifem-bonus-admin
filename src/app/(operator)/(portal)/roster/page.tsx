import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { AreasPanel } from "@/components/roster/AreasPanel";
import { ImportPanel } from "@/components/roster/ImportPanel";
import { PeoplePanel } from "@/components/roster/PeoplePanel";
import {
  lastPageOffset,
  PEOPLE_PAGE_SIZE,
  peopleApiQuery,
  peopleFilters,
  ROLES,
  rosterTab,
  STATUSES,
  type RosterTab,
} from "@/components/roster/roster-query";
import { StoresPanel } from "@/components/roster/StoresPanel";
import {
  Alert,
  Field,
  FilterBar,
  PageHeader,
  SelectField,
  TablePager,
  Tabs,
  withQuery,
  type Query,
} from "@/components/ui";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";

export function generateMetadata() {
  return portalMetadata("roster");
}

/** The tab's own URL. The store filter (OP-01) rides along, so it is still set on the way
 *  back to People. */
function tabHref(query: Query, tab: RosterTab): string {
  const store = typeof query.store === "string" ? query.store : undefined;
  return `/roster${withQuery({ store }, { tab: tab === "people" ? null : tab })}`;
}

/**
 * Roster (plan G1, D20): the people, stores and areas in the program, and the CSV import.
 * Every read happens here on the server through the typed client; the tabs, filters and
 * paging are links and a GET form, so a view can be shared and the back button undoes a
 * filter. The add, edit, terminate and import controls are the client panels', which save
 * through the BFF and then draw this page again.
 */
export default async function RosterPage({ searchParams }: PageProps<"/roster">) {
  const query = (await searchParams) as Query;
  const tab = rosterTab(query);
  const here = `/roster${withQuery(query, {})}`;
  const [t, tPage, te] = await Promise.all([
    getTranslations("roster"),
    getTranslations("pages.roster"),
    getTranslations("errors"),
  ]);
  const failed = (code: string) => (
    <Alert kind="error">
      {t("loadError")} {te.has(code) ? te(code) : te("generic")}{" "}
      <Link href={here} className="font-extrabold underline underline-offset-2">
        {t("retry")}
      </Link>
    </Alert>
  );

  let content: React.ReactNode;
  if (tab === "people") {
    const filters = peopleFilters(query);
    const loaded = await settle(here, async () => {
      const api = await serverApi();
      const [stores, areas] = await Promise.all([
        api.GET("/api/v1/portal/stores").then(body),
        api.GET("/api/v1/portal/areas").then(body),
      ]);
      const people = body(
        await api.GET("/api/v1/portal/people", { params: { query: peopleApiQuery(filters, stores) } }),
      );
      return { stores, areas, people };
    });
    if (!loaded.ok) {
      content = failed(loaded.code);
    } else {
      const { stores, areas, people } = loaded.data;
      // A page past the end (a filter shrank the list, a bookmark aged) shows the last one.
      const last = lastPageOffset(filters.offset, people.total);
      if (last !== null) redirect(`/roster${withQuery(query, { offset: last || null })}`);
      const filtered = Boolean(filters.role || filters.store || filters.q || filters.status !== "active");
      content = (
        <>
          <FilterBar
            action="/roster"
            query={query}
            label={t("filters.label")}
            submitLabel={t("filters.apply")}
            className="rounded-2xl border border-border bg-surface-raised p-4.5"
          >
            <div className="w-full sm:w-60">
              <Field
                label={t("filters.search")}
                name="q"
                type="search"
                defaultValue={filters.q ?? ""}
                placeholder={t("filters.searchPlaceholder")}
                maxLength={80}
              />
            </div>
            <div className="w-full sm:w-44">
              <SelectField label={t("filters.role")} name="role" defaultValue={filters.role ?? ""}>
                <option value="">{t("filters.anyRole")}</option>
                {ROLES.map((role) => (
                  <option key={role} value={role}>
                    {t(`roles.${role}`)}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="w-full sm:w-52">
              <SelectField label={t("filters.store")} name="store" defaultValue={filters.store ?? ""}>
                <option value="">{t("filters.anyStore")}</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.number}>
                    {`${store.number} · ${store.name}`}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="w-full sm:w-44">
              <SelectField label={t("filters.status")} name="status" defaultValue={filters.status}>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`filters.statuses.${status}`)}
                  </option>
                ))}
              </SelectField>
            </div>
          </FilterBar>
          <PeoplePanel
            people={people.items}
            total={people.total}
            stores={stores}
            areas={areas}
            filtered={filtered}
          />
          <TablePager
            query={query}
            className="mt-0"
            page={{ rows: people.items, offset: filters.offset, size: PEOPLE_PAGE_SIZE, total: people.total }}
          />
        </>
      );
    }
  } else if (tab === "stores") {
    const loaded = await settle(here, async () => {
      const api = await serverApi();
      const [stores, areas] = await Promise.all([
        api.GET("/api/v1/portal/stores").then(body),
        api.GET("/api/v1/portal/areas").then(body),
      ]);
      return { stores, areas };
    });
    content = loaded.ok ? <StoresPanel stores={loaded.data.stores} areas={loaded.data.areas} /> : failed(loaded.code);
  } else if (tab === "areas") {
    const loaded = await settle(here, async () => body(await (await serverApi()).GET("/api/v1/portal/areas")));
    content = loaded.ok ? <AreasPanel areas={loaded.data} /> : failed(loaded.code);
  } else {
    content = <ImportPanel />;
  }

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />
      <Tabs
        label={t("tabs.label")}
        current={tab}
        items={(["people", "stores", "areas", "import"] as const).map((key) => ({
          key,
          label: t(`tabs.${key}`),
          href: tabHref(query, key),
        }))}
      />
      {content}
    </>
  );
}
