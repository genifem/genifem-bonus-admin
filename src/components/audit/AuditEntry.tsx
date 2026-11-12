import type { Schemas } from "@crewstars/api-client";
import {
  ArrowRight,
  ChevronDown,
  Gift,
  Heart,
  History,
  KeyRound,
  ListChecks,
  ScrollText,
  SlidersHorizontal,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { formatCount, formatUsd } from "@/components/recognition/numbers";
import { cx } from "@/components/ui/cx";
import { VisuallyHidden } from "@/components/ui/VisuallyHidden";

import {
  auditChanges,
  auditDetails,
  auditSentence,
  changeLayout,
  type AuditBook,
  type ChangeRow,
  type DetailRow,
  type Word,
} from "./audit-format";
import { historyHref, type AuditKind } from "./audit-query";

type AuditEvent = Schemas["AuditEventOut"];

/** Each kind of change's mark, on its tint: the pairs hold 4.5:1 (plan §13). Decorative: the
 *  kind is also written beside the time. */
const KIND_MARK: Record<AuditKind, { icon: LucideIcon; tone: string }> = {
  settings: { icon: SlidersHorizontal, tone: "bg-sky text-sky-ink" },
  rewards: { icon: Gift, tone: "bg-mint text-mint-ink" },
  requests: { icon: ListChecks, tone: "bg-butter text-gold-ink" },
  recognition: { icon: Heart, tone: "bg-red-soft text-red-action" },
  roster: { icon: Users, tone: "bg-lilac text-lilac-ink" },
  awards: { icon: Trophy, tone: "bg-peach text-peach-ink" },
  sign_in: { icon: KeyRound, tone: "bg-surface text-foreground" },
};
const OTHER_MARK = { icon: ScrollText, tone: "bg-surface text-foreground" };

/** What a "History" link can open: a record with more than one event to its name. */
const HISTORY_TARGETS = new Set(["person", "store", "area", "reward"]);

/** Says a Word (audit-format.ts) in the owner's language. */
function useSay() {
  const t = useTranslations();
  const format = useFormatter();
  const locale = useLocale();
  function values(input: Record<string, Word | number> | undefined): Record<string, string | number> {
    return Object.fromEntries(
      Object.entries(input ?? {}).map(([name, value]) => [name, typeof value === "number" ? value : say(value)]),
    );
  }
  function say(word: Word): string {
    if ("text" in word) return word.text;
    if ("count" in word) return formatCount(word.count, locale);
    if ("usd" in word) return formatUsd(word.usd, locale);
    if ("list" in word) return format.list(word.list.map(say), { type: "conjunction" });
    if ("day" in word) {
      return format.dateTime(new Date(`${word.day.slice(0, 10)}T00:00:00Z`), { dateStyle: "medium", timeZone: "UTC" });
    }
    if ("month" in word) {
      const match = /^(\d{4})-(\d{2})$/.exec(word.month);
      return match
        ? format.dateTime(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1)), {
            month: "long",
            year: "numeric",
            timeZone: "UTC",
          })
        : word.month;
    }
    return t(word.msg, values(word.values));
  }
  return { say, values };
}

/**
 * One entry of the audit log (NF-09): what happened in a sentence, with who did it in bold;
 * when, relative ("2 hours ago") with the exact time on hover and for a screen reader; the
 * kind of change; and, folded under "What changed", the values before and after and anything
 * else recorded. A native <details>, so it opens from the keyboard and says whether it is open
 * with no script.
 *
 * Not a client component on purpose, like PostFeed: the server page draws the first page with
 * it and AuditTimeline draws the ones "Load more" fetches, from the same code. `now` is the
 * request's time, so "2 hours ago" is the same on the server and in the browser.
 */
export function AuditEntry({
  event,
  book,
  now,
  historyOf,
}: {
  event: AuditEvent;
  book: AuditBook;
  now: Date;
  /** The record whose history the page shows: its own entries need no link back to it. */
  historyOf: string | null;
}) {
  const t = useTranslations("audit");
  const tAll = useTranslations();
  const format = useFormatter();
  const { say, values } = useSay();

  const sentence = auditSentence(event, book);
  const changes = auditChanges(event, book);
  const details = auditDetails(event, book);
  const at = new Date(event.at);
  // The portal reads dates in UTC (src/i18n/request.ts), so the exact time says so.
  const exact = format.dateTime(at, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  });
  const mark = event.kind ? KIND_MARK[event.kind] : OTHER_MARK;
  const target = event.target;
  const history =
    target?.id && HISTORY_TARGETS.has(target.type) && target.id !== historyOf
      ? { href: historyHref(target.id), name: target.label }
      : null;

  return (
    // Focusable from script only: "Load more" moves focus to the first entry it adds.
    <li
      id={`audit-${event.id}`}
      tabIndex={-1}
      className="flex gap-3 border-b border-border py-3.5 first:pt-0 last:border-b-0 last:pb-0"
    >
      <span aria-hidden="true" className={cx("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", mark.tone)}>
        <mark.icon className="size-4.5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="break-words">
          {tAll.rich(sentence.key, {
            ...values(sentence.values),
            b: (chunks) => <b className="font-extrabold">{chunks}</b>,
          })}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-caption text-muted">
          <time dateTime={event.at} title={exact}>
            {format.relativeTime(at, now)}
            <VisuallyHidden>{`, ${exact}`}</VisuallyHidden>
          </time>
          {event.kind ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{t(`kinds.${event.kind}`)}</span>
            </>
          ) : null}
        </p>
        {changes.length > 0 || details.length > 0 || history ? (
          // "What changed" and "History" side by side, each a 44px target (NF-11); an open
          // panel takes the whole row and the link moves under it.
          <div className="mt-1 flex flex-wrap items-start gap-x-5">
            {changes.length > 0 || details.length > 0 ? (
              <details className="group min-w-0 open:basis-full">
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
                  {changes.length > 0 ? t("changes.show") : t("changes.showDetails")}
                </summary>
                <div className="flex flex-col gap-3 rounded-xl bg-surface p-3">
                  {changes.length > 0 ? <Changes rows={changes} say={say} /> : null}
                  {details.length > 0 ? <Details rows={details} say={say} /> : null}
                </div>
              </details>
            ) : null}
            {history ? (
              <Link
                href={history.href}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-compact pr-1 text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
              >
                <History aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
                {t("history.link")}
                {history.name ? <VisuallyHidden>{` ${t("history.linkFor", { name: history.name })}`}</VisuallyHidden> : null}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

const rowClass = "grid gap-x-4 gap-y-0.5 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]";
const fieldClass = "break-words text-caption font-bold text-muted";

/**
 * The values before and after, a field to a row: the field, then "31 → 30". Stacked on a
 * phone and side by side from `sm`, so a long Spanish label never squeezes the values. A new
 * record shows only what it was made with, a deleted one only what it was.
 */
function Changes({ rows, say }: { rows: readonly ChangeRow[]; say: (word: Word) => string }) {
  const t = useTranslations("audit");
  const layout = changeLayout(rows);
  const none = (
    <>
      <span aria-hidden="true">—</span>
      <VisuallyHidden>{t("values.notSet")}</VisuallyHidden>
    </>
  );
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      {rows.map((row) => (
        <div key={row.key} className={rowClass}>
          <dt className={fieldClass}>{say(row.field)}</dt>
          <dd className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 break-words">
            {layout === "changed" ? (
              <>
                <span className="min-w-0 text-muted">
                  <VisuallyHidden>{`${t("changes.was")} `}</VisuallyHidden>
                  {row.before ? say(row.before) : none}
                </span>
                <ArrowRight aria-hidden="true" className="size-3.5 shrink-0 self-center text-muted" strokeWidth={2.4} />
                <span className="min-w-0 font-bold">
                  <VisuallyHidden>{`${t("changes.now")} `}</VisuallyHidden>
                  {row.after ? say(row.after) : none}
                </span>
              </>
            ) : (
              <span className="min-w-0 font-bold">{say((layout === "added" ? row.after : row.before) ?? { text: "" })}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Anything else the action recorded: an import's counts, a request's coins and store. */
function Details({ rows, say }: { rows: readonly DetailRow[]; say: (word: Word) => string }) {
  return (
    <dl className="flex flex-col gap-2.5 text-sm">
      {rows.map((row) => (
        <div key={row.key} className={rowClass}>
          <dt className={fieldClass}>{say(row.field)}</dt>
          <dd className="min-w-0 break-words font-bold">{say(row.value)}</dd>
        </div>
      ))}
    </dl>
  );
}
