import type { Schemas } from "@crewstars/api-client";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";

import { Avatar, cx } from "@/components/ui";
import { ringInside } from "@/components/ui/focus";

import { Ago, when } from "./parts";

type AuditEvent = Schemas["PlatformAuditEventOut"];

/** The i18n key of an action: "owner.mfa_reset" -> "owner_mfa_reset". */
export function actionKey(action: string): string {
  return action.replace(/\./g, "_");
}

/**
 * The back office's own log, as a list (P7): what was done, by whom, to which operator, why,
 * and when - the reason every write asks for is shown with it. Used whole on the Audit log
 * page (`details`: before and after, the address and the request id, behind a disclosure),
 * and as the last few on the overview and on an operator's page.
 *
 * An action this version does not have words for is shown as the API names it.
 */
export async function AuditEvents({
  events,
  now,
  details = false,
  operatorLinks = true,
  label,
}: {
  events: readonly AuditEvent[];
  now: Date;
  /** The full entry: before and after, IP, request id. */
  details?: boolean;
  /** Each operator's name links to its page (not on that page itself). */
  operatorLinks?: boolean;
  /** Names the list for a screen reader. */
  label: string;
}) {
  const [t, format] = await Promise.all([getTranslations("platform.audit"), getFormatter()]);
  return (
    <ol aria-label={label} className="flex flex-col">
      {events.map((event) => {
        const key = actionKey(event.action);
        const action = t.has(`actions.${key}`) ? t(`actions.${key}`) : event.action;
        const actor = event.actor.name ?? event.actor.email ?? t("system");
        const hasChange = event.before !== null || event.after !== null || Object.keys(event.details).length > 0;
        return (
          <li key={event.id} className="flex gap-3 border-t border-border py-3 first:border-t-0 first:pt-0 last:pb-0">
            <Avatar name={actor} colored={Boolean(event.actor.id)} seed={event.actor.id ?? actor} className="mt-0.5 size-8.5 text-caption" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-sm">
                <b className="font-extrabold">{actor}</b> <span>{action}</span>
                {event.operator ? (
                  <>
                    {" · "}
                    {operatorLinks ? (
                      <Link
                        href={`/operators/${event.operator.id}`}
                        className={cx("font-bold text-brand-ink underline-offset-2 hover:underline", ringInside)}
                      >
                        {event.operator.name ?? event.operator.slug ?? t("anOperator")}
                      </Link>
                    ) : (
                      <span className="font-bold">{event.operator.name ?? event.operator.slug}</span>
                    )}
                  </>
                ) : null}
              </p>
              {event.reason ? (
                <p className="mt-0.5 break-words text-sm text-muted">
                  <span className="sr-only">{t("reason")}: </span>“{event.reason}”
                </p>
              ) : null}
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                <Ago format={format} iso={event.at} now={now} never="" />
                <code translate="no" className="font-mono">
                  {event.action}
                </code>
                {details && event.ip ? <span>{t("ip", { ip: event.ip })}</span> : null}
              </p>
              {details && hasChange ? (
                <details className="group mt-1.5">
                  <summary
                    className={cx(
                      "inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-compact pr-1 text-sm font-extrabold text-brand-ink",
                      "[&::-webkit-details-marker]:hidden",
                    )}
                  >
                    <ChevronDown
                      aria-hidden="true"
                      className="size-4 shrink-0 transition-transform duration-fast group-open:rotate-180"
                      strokeWidth={2.4}
                    />
                    {t("showChange")}
                  </summary>
                  <dl className="mt-1 grid gap-2 rounded-xl bg-surface p-3 text-xs">
                    <Change label={t("before")} value={event.before} />
                    <Change label={t("after")} value={event.after} />
                    {Object.keys(event.details).length > 0 ? <Change label={t("more")} value={event.details} /> : null}
                    <div>
                      <dt className="font-bold">{t("at")}</dt>
                      <dd>{when(format, event.at)}</dd>
                    </div>
                    {event.request_id ? (
                      <div>
                        <dt className="font-bold">{t("requestId")}</dt>
                        <dd>
                          <code className="break-all font-mono">{event.request_id}</code>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </details>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Change({ label, value }: { label: string; value: Record<string, unknown> | null }) {
  if (value === null) return null;
  return (
    <div className="min-w-0">
      <dt className="font-bold">{label}</dt>
      <dd>
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all font-mono">{JSON.stringify(value, null, 2)}</pre>
      </dd>
    </div>
  );
}
