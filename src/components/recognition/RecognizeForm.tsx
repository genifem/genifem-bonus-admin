"use client";

import type { Schemas } from "@crewstars/api-client";
import { Check, Coins, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import { RoleChip } from "@/components/roster/RosterBits";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { cx } from "@/components/ui/cx";
import { Field, FieldMessage, TextareaField } from "@/components/ui/Field";
import { labelClass } from "@/components/ui/controls";
import { useToast } from "@/components/ui/Toast";
import { apiPost, ApiCallError } from "@/lib/api";

import { BudgetNote } from "./BudgetNote";
import { CoinPill, TAG_STYLE } from "./Chips";
import { checkAmount, coinsToUsd, formatCount, formatUsd } from "./numbers";
import {
  afterAttempt,
  intentFor,
  outcomeOf,
  sendProblem,
  shoutoutBody,
  type SendIntent,
  type SendProblem,
  type TagId,
} from "./send-intent";

type Candidate = Schemas["CandidateOut"];

export interface SendContext {
  tags: readonly TagId[];
  /** The owner's three preset amounts. */
  amounts: readonly number[];
  customMin: number;
  customMax: number;
  messageMax: number;
  kudos: Schemas["KudosOut"];
}

/** A choice drawn as a chip: a radio button underneath, so the group is one tab stop and the
 *  arrow keys move through it. The check mark says which is chosen, not the colour alone. */
const chipClass = (chosen: boolean, tone: string) =>
  cx(
    "relative inline-flex min-h-11 cursor-pointer select-none items-center gap-1.5 rounded-compact border-2 px-3 text-caption font-extrabold",
    "has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-ink",
    tone,
    chosen ? "border-current" : "border-transparent",
  );

/**
 * The owner's shout-out (OP-07): every tag including Great Leadership, the owner's preset
 * amounts or a custom one (1 to 5,000), a message of up to 200 characters, and what is left of
 * the owner's recognition budget - which is what pays for it, never anyone's balance.
 *
 * Send carries one Idempotency-Key per intent (send-intent.ts), so a double press or a retry
 * after a dropped connection makes one post. It is off while sending and whenever the API
 * would refuse the send anyway (no tag, an amount out of range or past the budget). After a
 * send the page is drawn again from the server, which brings the new budget and the post in
 * "Your recent recognitions".
 *
 * Mount it with `key={person.id}`, so each person starts from a fresh form.
 */
export function RecognizeForm({
  person,
  context,
  coinValue,
}: {
  person: Candidate;
  context: SendContext;
  /** Dollars per coin, for the estimate; null when the settings could not be read. */
  coinValue: number | null;
}) {
  const t = useTranslations("recognition.recognize");
  const tTags = useTranslations("recognition.tags");
  const tRec = useTranslations("recognition");
  const te = useTranslations("errors");
  const locale = useLocale();
  const router = useRouter();
  const toast = useToast();
  const id = useId();

  const { amounts, customMin, customMax, messageMax, kudos } = context;
  const [tag, setTag] = useState<TagId | null>(null);
  const [choice, setChoice] = useState<number | "custom">(amounts[1] ?? amounts[0] ?? "custom");
  const [custom, setCustom] = useState("");
  const [message, setMessage] = useState("");
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const [problem, setProblem] = useState<SendProblem | null>(null);
  /** The send still waiting for an answer we never got: its key is reused (plan D13). */
  const pending = useRef<SendIntent | null>(null);
  /** Set synchronously, so a second press in the same frame cannot start a second request. */
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  // The kit's fields own their ids, so these reach the control through the box around it.
  const customBox = useRef<HTMLDivElement>(null);
  const messageBox = useRef<HTMLDivElement>(null);

  // Picking someone brings the form into view (below the list on a phone) and says who it is
  // for: focus moves to its heading.
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: "nearest" });
  }, []);

  const left = kudos.left;
  const check =
    choice === "custom"
      ? checkAmount(custom, { min: customMin, max: customMax, left })
      : checkAmount(String(choice), { min: 1, max: Number.MAX_SAFE_INTEGER, left });
  const busy = sending || refreshing;
  const ready = tag !== null && check.ok;

  const amountText = (problemCode: "required" | "whole" | "range" | "over") =>
    problemCode === "range"
      ? t("amountProblems.range", { min: formatCount(customMin, locale), max: formatCount(customMax, locale) })
      : problemCode === "over"
        ? t("amountProblems.over", { left })
        : problemCode === "whole"
          ? t("amountProblems.whole")
          : t("amountProblems.required");
  const customError =
    choice === "custom" && !check.ok && (custom.trim() !== "" || tried) ? amountText(check.problem) : undefined;
  const presetError = choice !== "custom" && !check.ok ? amountText(check.problem) : undefined;
  const missing = !tag ? t("needTag") : !check.ok ? amountText(check.problem) : undefined;

  const problemText = (found: SendProblem) =>
    te.has(found.code) ? te(found.code, found.values) : te("generic");

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (!tag || !check.ok || inFlight.current) return;
    inFlight.current = true;
    setSending(true);
    setProblem(null);
    const coins = check.coins;
    const intent = intentFor(pending.current, { to_id: person.id, tag, coins, message });
    pending.current = intent;
    try {
      await apiPost<Schemas["ShoutoutResult"]>(
        "/portal/shoutouts",
        shoutoutBody({ to_id: person.id, tag, coins, message }),
        { idempotencyKey: intent.key },
      );
      pending.current = afterAttempt(intent, "sent");
      toast.show(t("sent", { name: person.first_name, coins }));
      setMessage("");
      setTried(false);
      messageBox.current?.querySelector("textarea")?.focus();
    } catch (err) {
      const failure = err instanceof ApiCallError ? err : { status: 0, code: "network", details: undefined };
      pending.current = afterAttempt(intent, outcomeOf(failure));
      setProblem(sendProblem(failure, { left, max: messageMax }));
    } finally {
      inFlight.current = false;
      setSending(false);
    }
    // The budget, the person's balance and "Your recent recognitions" all changed - or, after
    // a refusal over the budget, the budget the page shows was out of date.
    startRefresh(() => router.refresh());
  }

  const where = person.store
    ? tRec("storeNamed", { number: person.store.number, name: person.store.name })
    : (person.area?.name ?? null);
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar name={person.name} colored seed={person.id} className="size-12 text-body" />
        <div className="min-w-0 flex-1">
          <h2
            id={`${id}-heading`}
            ref={heading}
            tabIndex={-1}
            className="break-words text-xl font-black tracking-normal outline-none"
          >
            {person.name}
          </h2>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-caption text-muted">
            <RoleChip role={person.role} />
            {where ? <span>{where}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="text-2xs font-black uppercase tracking-wide text-muted">{t("balance")}</span>
          <CoinPill coins={person.balance} />
        </div>
      </div>

      <form noValidate onSubmit={(event) => void send(event)} className="flex flex-col gap-4.5">
        <fieldset className="min-w-0">
          <legend className={labelClass}>{t("tag")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {context.tags.map((value) => {
              const { tone, icon: Icon } = TAG_STYLE[value];
              const chosen = tag === value;
              return (
                <label key={value} className={chipClass(chosen, tone)}>
                  <input
                    type="radio"
                    name={`${id}-tag`}
                    value={value}
                    checked={chosen}
                    onChange={() => setTag(value)}
                    className="sr-only"
                  />
                  <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.4} />
                  {tTags(value)}
                  {chosen ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={3} /> : null}
                </label>
              );
            })}
          </div>
          {tried && !tag ? <FieldMessage error={t("needTag")} /> : null}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className={labelClass}>{t("amount")}</legend>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {amounts.map((value) => (
              <label key={value} className={chipClass(choice === value, "bg-butter text-gold-ink")}>
                <input
                  type="radio"
                  name={`${id}-amount`}
                  value={value}
                  checked={choice === value}
                  onChange={() => setChoice(value)}
                  className="sr-only"
                />
                <Coins aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.4} />
                <span className="tabular-nums">{formatCount(value, locale)}</span>
                {choice === value ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={3} /> : null}
              </label>
            ))}
            <label className={chipClass(choice === "custom", "bg-surface text-foreground")}>
              <input
                type="radio"
                name={`${id}-amount`}
                value="custom"
                checked={choice === "custom"}
                onChange={() => {
                  setChoice("custom");
                  customBox.current?.querySelector("input")?.focus();
                }}
                className="sr-only"
              />
              {t("custom")}
              {choice === "custom" ? <Check aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={3} /> : null}
            </label>
          </div>
          {presetError ? <FieldMessage error={presetError} /> : null}
          <div ref={customBox} className="mt-3 w-full sm:w-56">
            <Field
              label={t("customAmount")}
              hint={t("customHint", { min: formatCount(customMin, locale), max: formatCount(customMax, locale) })}
              error={customError}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              value={custom}
              onChange={(event) => {
                setCustom(event.target.value);
                setChoice("custom");
              }}
            />
          </div>
          {coinValue !== null && check.ok ? (
            <p className="mt-2 text-caption text-muted tabular-nums">
              {t("usd", { usd: formatUsd(coinsToUsd(check.coins, coinValue), locale) })}
            </p>
          ) : null}
        </fieldset>

        <div ref={messageBox}>
          <TextareaField
            label={t("message")}
            hint={t("messageCount", { count: message.length, max: messageMax })}
            placeholder={t("messagePlaceholder")}
            maxLength={messageMax}
            rows={3}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
        </div>

        <BudgetNote kudos={kudos} />

        {problem ? <Alert>{problemText(problem)}</Alert> : null}

        <div className="flex flex-col gap-1.5">
          <Button
            type="submit"
            size="form"
            fullWidth
            loading={sending}
            disabled={busy || !ready}
            aria-describedby={missing ? `${id}-missing` : undefined}
            icon={<Send aria-hidden="true" className="size-4.5" strokeWidth={2.2} />}
          >
            {check.ok ? t("send", { coins: check.coins, name: person.first_name }) : t("sendPlain")}
          </Button>
          {missing ? (
            <p id={`${id}-missing`} className="text-center text-caption text-muted">
              {missing}
            </p>
          ) : null}
        </div>
      </form>
    </section>
  );
}
