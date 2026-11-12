import type { Schemas } from "@crewstars/api-client";
import { Heart, MessageCircle, Users } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { portalMetadata } from "@/components/console/PortalPage";
import { BudgetNote } from "@/components/recognition/BudgetNote";
import { CoinPill } from "@/components/recognition/Chips";
import { Panel } from "@/components/recognition/Panel";
import { PostFeed } from "@/components/recognition/PostFeed";
import { QuerySearch } from "@/components/recognition/QueryControls";
import { RecognizeForm, type SendContext } from "@/components/recognition/RecognizeForm";
import {
  activeFilter,
  CANDIDATE_FILTERS,
  candidatesApiQuery,
  DEFAULT_FILTER,
  recognizeState,
  type CandidateFilter,
} from "@/components/recognition/recognition-query";
import { TAGS } from "@/components/recognition/send-intent";
import { StoreFilter } from "@/components/recognition/StoreFilter";
import { RoleChip } from "@/components/roster/RosterBits";
import { Alert, Avatar, cx, FilterChips, PageHeader, withQuery, type Query } from "@/components/ui";
import { ringInside } from "@/components/ui/focus";
import { serverApi } from "@/lib/server-api";
import { body, settle } from "@/lib/server-load";
import { findStore } from "@/lib/store-scope";

export function generateMetadata() {
  return portalMetadata("recognize");
}

type Candidate = Schemas["CandidateOut"];

/** The owner's own limits when the API leaves one out: 1 to 5,000 coins, 200 characters. */
const CUSTOM_MIN = 1;
const CUSTOM_MAX = 5000;

/**
 * Recognize anyone (OP-06, OP-07). On the left, who: a role filter (Leaders by default), a
 * store filter and a name search, all in the URL, over the people the API says an owner can
 * recognize. On the right, the shout-out form for whoever is picked (`?to=`), what is left of
 * the owner's budget, and the owner's recent recognitions.
 *
 * `?to=` arrives from a Recognize button elsewhere (Overview, Stores & people). That person is
 * read on their own (GET /portal/recognize/candidates/{id}), and when the URL names no role
 * filter the list opens on theirs, so they are in it.
 */
export default async function RecognizePage({ searchParams }: PageProps<"/recognize">) {
  const query = (await searchParams) as Query;
  const state = recognizeState(query);
  const here = `/recognize${withQuery(query, {})}`;
  const now = new Date();
  const [t, tPage, tr, te] = await Promise.all([
    getTranslations("recognition.recognize"),
    getTranslations("pages.recognize"),
    getTranslations("recognition"),
    getTranslations("errors"),
  ]);

  const loaded = await settle(here, async () => {
    const api = await serverApi();
    /** The person `?to=` names; undefined once they are off the roster (404 recipient_not_found).
     *  Any other failure, a bare 404 included, is the page's to show. */
    const person = async (id: string): Promise<Candidate | undefined> => {
      try {
        return body(
          await api.GET("/api/v1/portal/recognize/candidates/{person_id}", { params: { path: { person_id: id } } }),
        );
      } catch (err) {
        if ((err as { code?: unknown }).code === "recipient_not_found") return undefined;
        throw err;
      }
    };
    const [stores, context, settings, selected] = await Promise.all([
      api.GET("/api/v1/portal/stores").then(body),
      api.GET("/api/v1/portal/recognize/context").then(body),
      // Only for the dollar estimate beside the amount: the page stands without it.
      api
        .GET("/api/v1/portal/settings")
        .then(body)
        .catch(() => null),
      state.to ? person(state.to) : undefined,
    ]);
    const store = findStore(state.store, stores);
    // Their role decides which list to open on when the URL names none.
    const filter: CandidateFilter = activeFilter(state, selected?.role);
    const candidates = body(
      await api.GET("/api/v1/portal/recognize/candidates", {
        params: { query: candidatesApiQuery(filter, store?.id, state.q) },
      }),
    );
    return { stores, store, context, coinValue: settings?.rules.coin_value ?? null, filter, candidates, selected };
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

  const { stores, store, context, coinValue, filter, candidates, selected } = loaded.data;
  const sendContext: SendContext = {
    // Every tag, Great Leadership included (OP-07), in the API's order.
    tags: context.tags.length ? context.tags : TAGS,
    amounts: context.amounts,
    customMin: context.custom_min ?? CUSTOM_MIN,
    customMax: context.custom_max ?? CUSTOM_MAX,
    messageMax: context.message_max,
    kudos: context.kudos,
  };
  // A pick keeps the list it was made from: the filter is written into the link whenever it
  // is not the one the page would open on by itself.
  const pinned = (key: CandidateFilter) => (key === DEFAULT_FILTER && !state.to ? null : key);

  return (
    <>
      <PageHeader title={tPage("title")} lead={tPage("lead")} />

      <div className="grid items-start gap-4.5 lg:grid-cols-2">
        <Panel id="who-heading" title={t("who")} icon={Users}>
          <FilterChips
            label={t("filters.label")}
            active={filter}
            chips={CANDIDATE_FILTERS.map((key) => ({
              key,
              label: t(`filters.${key}`),
              href: `/recognize${withQuery(query, { filter: pinned(key) })}`,
            }))}
          />
          <div className="flex flex-wrap items-end gap-3">
            <StoreFilter stores={stores} selected={store} className="sm:w-56" />
            <QuerySearch
              label={t("search")}
              value={state.q ?? ""}
              placeholder={t("searchPlaceholder")}
              className="flex-1 sm:min-w-48"
            />
          </div>
          <p className="text-caption font-semibold text-muted" role="status">
            {t("count", { count: candidates.length })}
          </p>
          {candidates.length === 0 ? (
            <p className="rounded-lg bg-surface p-4 text-sm text-muted">{t("noMatch")}</p>
          ) : (
            <ul aria-label={t("listLabel")} className="-mx-1 flex max-h-130 flex-col gap-1.5 overflow-y-auto px-1 py-0.5">
              {candidates.map((person) => {
                const current = person.id === selected?.id;
                // A supervisor has no one store but the stores they cover: their numbers here,
                // in full on hover and once picked.
                const where = person.store
                  ? tr("storeNamed", { number: person.store.number, name: person.store.name })
                  : person.stores.length > 0
                    ? t("stores", { list: person.stores.map((store) => store.number).join(", ") })
                    : (person.area?.name ?? "");
                const whereTitle =
                  !person.store && person.stores.length > 0
                    ? person.stores.map((store) => `${store.number} · ${store.name}`).join(", ")
                    : undefined;
                return (
                  <li key={person.id}>
                    <Link
                      href={`/recognize${withQuery(query, { to: person.id, filter: state.filter ?? pinned(filter) })}`}
                      scroll={false}
                      aria-current={current ? "true" : undefined}
                      className={cx(
                        "flex min-h-14 items-center gap-3 rounded-lg border-[1.5px] px-3 py-2 transition-colors duration-fast",
                        current ? "border-brand bg-brand-subtle" : "border-border bg-surface-raised hover:border-brand",
                        ringInside,
                      )}
                    >
                      <Avatar name={person.name} colored seed={person.id} className="size-9 text-caption" />
                      <span className="min-w-0 flex-1">
                        <span className="block break-words font-extrabold">{person.name}</span>
                        {where ? (
                          <span className="block text-caption text-muted" title={whereTitle}>
                            {where}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        <RoleChip role={person.role} />
                        <CoinPill coins={person.balance} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="rounded-2xl border border-border bg-surface-raised p-4.5">
            {state.to && !selected ? (
              <Alert kind="warning" className="mb-4">
                {t("notFound")}
              </Alert>
            ) : null}
            {selected ? (
              <RecognizeForm key={selected.id} person={selected} context={sendContext} coinValue={coinValue} />
            ) : (
              <section aria-labelledby="pick-heading" className="flex flex-col gap-3">
                <h2 id="pick-heading" className="flex items-center gap-2 text-title font-black tracking-normal">
                  <Heart aria-hidden="true" className="size-5 shrink-0 text-brand-ink" strokeWidth={2.2} />
                  {t("pick")}
                </h2>
                <p className="text-sm text-muted">{t("pickLead")}</p>
                <BudgetNote kudos={context.kudos} />
              </section>
            )}
          </div>

          <Panel id="mine-heading" title={t("recent")} icon={MessageCircle}>
            {context.recent.length === 0 ? (
              <p className="text-sm text-muted">{t("noRecent")}</p>
            ) : (
              <PostFeed posts={context.recent} now={now} showSender={false} label={t("recent")} />
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
