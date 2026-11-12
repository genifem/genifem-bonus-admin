"use client";

import type { Schemas } from "@crewstars/api-client";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { apiGet, ApiCallError } from "@/lib/api";

import { AuditEntry } from "./AuditEntry";
import type { AuditBook } from "./audit-format";
import { auditPath, type AuditState } from "./audit-query";

type AuditEvent = Schemas["AuditEventOut"];
type AuditPage = Schemas["AuditPage"];

/**
 * The log's list, newest first: the first page as the server drew it (`children`), then each
 * page "Load more" fetches through the BFF with the API's cursor (`next_before`). Older pages
 * are added under the ones on screen rather than replacing them, so an owner can read back
 * through a day without losing their place.
 *
 * After a page arrives, focus moves to its first entry and a status line says how many came,
 * so a keyboard or screen-reader user carries on reading from there. The page gives this a new
 * key when a filter changes, which starts it over.
 */
export function AuditTimeline({
  children,
  state,
  cursor,
  book,
  now,
  label,
}: {
  children: React.ReactNode;
  state: AuditState;
  /** The first page's `next_before`; null when it was the only page. */
  cursor: string | null;
  book: AuditBook;
  /** The request's time, as ISO: entries added later say "2 hours ago" from the same moment. */
  now: string;
  label: string;
}) {
  const t = useTranslations("audit");
  const te = useTranslations("errors");
  const [more, setMore] = useState<AuditEvent[]>([]);
  const [next, setNext] = useState(cursor);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [said, setSaid] = useState("");
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId) document.getElementById(`audit-${focusId}`)?.focus();
  }, [focusId]);

  async function loadMore() {
    if (!next || busy) return;
    setBusy(true);
    setError(null);
    try {
      const page = await apiGet<AuditPage>(auditPath(state, next));
      setMore((was) => {
        const seen = new Set(was.map((item) => item.id));
        return [...was, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setNext(page.next_before);
      setSaid(t("loaded", { count: page.items.length }));
      setFocusId(page.items[0]?.id ?? null);
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      setError(`${t("moreError")} ${te.has(code) ? te(code) : te("generic")}`);
    } finally {
      setBusy(false);
    }
  }

  const at = new Date(now);
  return (
    <>
      <ol aria-label={label} className="flex flex-col">
        {children}
        {more.map((event) => (
          <AuditEntry key={event.id} event={event} book={book} now={at} historyOf={state.target} />
        ))}
      </ol>
      <p role="status" className="sr-only">
        {said}
      </p>
      {error ? <Alert kind="error">{error}</Alert> : null}
      {next ? (
        <div className="flex justify-center border-t border-border pt-3.5">
          <Button
            variant="secondary"
            size="console"
            loading={busy}
            icon={<ChevronDown aria-hidden="true" className="size-4" strokeWidth={2.4} />}
            onClick={() => void loadMore()}
          >
            {t("more")}
          </Button>
        </div>
      ) : (
        <p className="border-t border-border pt-3.5 text-center text-caption text-muted">{t("end")}</p>
      )}
    </>
  );
}
