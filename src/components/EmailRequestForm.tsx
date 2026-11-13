"use client";

import { MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Alert, Button, Field } from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { lockMinutes } from "@/lib/lockout";

export interface EmailRequestLabels {
  title: string;
  lead: string;
  email: string;
  submit: string;
  /** Said whoever the email belongs to, so the page never tells anyone who is an owner. */
  sentTitle: string;
  sent: string;
  again: string;
}

/**
 * An email address in, "check your email" out (P7): "Forgot password?" on an operator's host
 * (POST /auth/owner/forgot) and "Find your company" on the bare domain (POST
 * /public/find-company). The API answers 202 whether or not the address belongs to an owner,
 * and so does this form: one message for everyone. Only a refusal that is not about the
 * address - too many tries from here, the API out of reach - is said as an error.
 *
 * The language goes with it, so the email arrives in the language the page is in. The words
 * come from the page (a Server Component), which knows which of the two this is.
 */
export function EmailRequestForm({
  endpoint,
  labels,
  footer,
}: {
  endpoint: "/auth/owner/forgot" | "/public/find-company";
  labels: EmailRequestLabels;
  /** Under the form: the way back to sign in. */
  footer?: React.ReactNode;
}) {
  const t = useTranslations("login");
  const te = useTranslations("errors");
  const locale = useLocale();
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const heading = useRef<HTMLHeadingElement>(null);

  // The answer replaces the form: focus goes to it, so it is read out.
  useEffect(() => {
    if (sent) heading.current?.focus();
  }, [sent]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = String(new FormData(event.currentTarget).get("email") ?? "").trim();
    setError(null);
    setFieldError(undefined);
    setPending(true);
    try {
      await apiPost(endpoint, { email, language: locale === "es" ? "es" : "en" });
      setSent(true);
    } catch (err) {
      const failure = err instanceof ApiCallError ? err : null;
      const code = failure?.code ?? "generic";
      if (code === "validation_failed" || code === "http_422") setFieldError(te("email_invalid"));
      else if (code === "rate_limited") {
        const minutes = lockMinutes(failure?.details);
        setError(minutes === null ? te("rate_limited") : t("rateLimitedFor", { minutes }));
      } else setError(te.has(code) ? te(code) : te("generic"));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <section aria-labelledby="request-sent" className="flex flex-col gap-3">
        <span
          aria-hidden="true"
          className="flex size-11 items-center justify-center rounded-compact bg-success-subtle text-success-ink"
        >
          <MailCheck className="size-5" strokeWidth={2} />
        </span>
        <h1 id="request-sent" ref={heading} tabIndex={-1} className="text-2xl font-black">
          {labels.sentTitle}
        </h1>
        <p className="text-sm text-muted">{labels.sent}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <Button type="button" variant="secondary" size="console" onClick={() => setSent(false)}>
            {labels.again}
          </Button>
          {footer}
        </div>
      </section>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-black">{labels.title}</h1>
      <p className="mt-1 text-sm text-muted">{labels.lead}</p>
      <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-4">
        <Field
          label={labels.email}
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          required
          disabled={pending}
          error={fieldError}
        />
        {error ? <Alert kind="error">{error}</Alert> : null}
        <Button type="submit" size="form" fullWidth loading={pending}>
          {labels.submit}
        </Button>
      </form>
      {footer ? <div className="mt-4 flex justify-center">{footer}</div> : null}
    </>
  );
}
