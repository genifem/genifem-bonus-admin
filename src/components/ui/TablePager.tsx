import { useTranslations } from "next-intl";

import { Pagination } from "./Pagination";
import type { Page } from "./paging";
import type { Query } from "./query";

/**
 * The foot of every paged table: "26–50 of 80" and Previous / Next, in the same words
 * everywhere. Drawn even on a single page, so a table always says how many it holds; an empty
 * list says so itself and draws no pager.
 */
export function TablePager({
  query,
  page,
  className = "mt-4",
}: {
  query: Query;
  page: Page<unknown>;
  className?: string;
}) {
  const t = useTranslations("common.page");
  if (page.total === 0) return null;
  const count = page.rows.length;
  return (
    <Pagination
      query={query}
      offset={page.offset}
      limit={page.size}
      count={count}
      total={page.total}
      className={className}
      labels={{
        label: t("label"),
        previous: t("previous"),
        next: t("next"),
        range: t("range", { first: page.offset + 1, last: page.offset + count, total: page.total }),
      }}
    />
  );
}
