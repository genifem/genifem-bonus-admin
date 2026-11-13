"use client";

import type { Schemas } from "@crewstars/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { OpenInApp, QrCode, RecoveryCodes, SecretKey } from "@/components/auth/MfaParts";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Alert, Button, buttonClass, Field, inputClass, Label, cx } from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { forgetFragmentParam, useFragmentParam } from "@/lib/fragment";
import { lockMinutes } from "@/lib/lockout";

type OwnerAuthOut = Schemas["OwnerAuthOut"];
type MfaSetupOut = Schemas["MfaSetupOut"];
type MfaEnabledOut = Schemas["MfaEnabledOut"];

/** The API's rule for an owner's password (CR-05): at least this long, with a number. */
export const OWNER_PASSWORD_MIN = 8;

/** Every way a sign-in can be refused for the credentials themselves reads the same, so the
 *  form never tells anyone which half was wrong. */
const WRONG_CREDENTIALS = new Set(["credentials_invalid", "unauthorized", "http_401"]);
/** A wrong code at the second step. mfa/verify counts it with the password tries and answers
 *  `credentials_invalid`; mfa/confirm answers `mfa_invalid`. Both read as a wrong code. */
const WRONG_CODE = new Set(["credentials_invalid", "mfa_invalid", "unauthorized", "http_401"]);
/** The second step can no longer go on: start again from the email and password. */
const START_AGAIN = new Set([
  "account_locked",
  "account_inactive",
  "token_expired",
  "token_invalid",
  "token_used",
  "token_wrong_tenant",
  "mfa_not_set_up",
]);

/** How an emailed link (P7) opens the form: an invite to choose a first password, or a reset
 *  to choose a new one. */
export type OwnerLink = "invite" | "reset";

type Step =
  | { kind: "credentials" }
  /** A password chosen from an emailed link, the token read from its fragment. */
  | { kind: "password" }
  /** An authenticator code (or a recovery code) for an owner with the second factor on. */
  | { kind: "mfa"; token: string }
  /** The second factor is on for the portal but this owner has not set it up yet. */
  | { kind: "setup"; token: string; setup: MfaSetupOut }
  /** Shown once, straight after setting it up. The session is already open. */
  | { kind: "recovery"; codes: string[] };

/** What a refused link means, in the link's own words: the API's token codes are about a
 *  sign-in step in errors.*, so a link says them here. */
function linkProblem(code: string, link: OwnerLink): "expired" | "used" | "invalid" | "wrongTenant" | null {
  if (code === "token_expired") return "expired";
  if (code === "token_used") return "used";
  if (code === "token_invalid") return "invalid";
  if (code === "token_wrong_tenant") return "wrongTenant";
  // An invite for an owner who has since been switched off.
  if (code === "account_inactive" && link === "invite") return "invalid";
  return null;
}

/**
 * Owner sign-in (plan D8): email and password, posted through the BFF to
 * /api/v1/auth/owner/login, which keeps the tokens in httpOnly cookies. "Forgot password?"
 * leads to /forgot (P7).
 *
 * With `link`, the same form is what an emailed link opens (P7): `/invite#token=…` to choose a
 * first password, `/reset#token=…` to choose a new one. The token is read from the fragment and
 * wiped from the address bar (lib/fragment.ts); the password is checked here against the API's
 * rule before it is sent, and the answer is a sign-in step like any other, so the steps below
 * follow on from it.
 *
 * With the second factor switched on (CS_OWNER_MFA_ENABLED), the API answers with a step
 * instead of a session: `mfa` asks for a code from the authenticator app (or a recovery code),
 * `mfa_setup` for one to be set up first - a QR code (or a key) to add to the app, a code from
 * it to prove it works, then the recovery codes, shown once. The steps that finish a sign-in
 * (mfa/verify, mfa/confirm) are token calls in the BFF too, so no token reaches this page.
 *
 * A refusal shows the API's code translated (`errors.<code>`), or the generic message for a
 * code the catalog does not know. A lockout, or too many tries from one place, says how long
 * it has left (CR-07).
 */
export function LoginForm({
  next,
  signedOut = false,
  link,
}: {
  next: string;
  signedOut?: boolean;
  link?: OwnerLink;
}) {
  const t = useTranslations("login");
  const te = useTranslations("errors");
  const router = useRouter();
  const codeId = useId();
  const [step, setStep] = useState<Step>(link ? { kind: "password" } : { kind: "credentials" });
  const linkToken = useFragmentParam(link ? "token" : null);
  const [error, setError] = useState<string | null>(null);
  /** A refused link: what happened, and the way on it offers. */
  const [linkFailure, setLinkFailure] = useState<ReturnType<typeof linkProblem>>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [repeatError, setRepeatError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  // A new step takes focus: straight into the code box when that is all there is to do, or to
  // the step's heading when there is something to read first.
  useEffect(() => {
    if (step.kind === "mfa") codeInput.current?.focus();
    else if (step.kind === "setup" || step.kind === "recovery") stepHeading.current?.focus();
  }, [step.kind]);

  function messageFor(err: unknown, stage: "credentials" | "code"): string {
    const failure = err instanceof ApiCallError ? err : null;
    const code = failure?.code ?? "generic";
    if (code === "account_locked" || code === "rate_limited") {
      const minutes = lockMinutes(failure?.details);
      if (minutes === null) return te(code);
      return code === "account_locked" ? t("lockedFor", { minutes }) : t("rateLimitedFor", { minutes });
    }
    if (stage === "code" && WRONG_CODE.has(code)) return te("mfa_invalid");
    if (WRONG_CREDENTIALS.has(code)) return te("credentials_invalid");
    return te.has(code) ? te(code) : te("generic");
  }

  function finish() {
    setLeaving(true);
    router.replace(next);
    router.refresh();
  }

  /** Where a sign-in step leads: into the portal, or on to the second factor. */
  async function follow(outcome: OwnerAuthOut) {
    if (outcome.step === "done") return finish();
    const token = outcome.mfa_token ?? "";
    if (outcome.step === "mfa") {
      setStep({ kind: "mfa", token });
      setPending(false);
      return;
    }
    const setup = await apiPost<MfaSetupOut>("/auth/owner/mfa/setup", { mfa_token: token });
    setStep({ kind: "setup", token, setup });
    setPending(false);
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      await follow(
        await apiPost<OwnerAuthOut>("/auth/owner/login", {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }),
      );
    } catch (err) {
      setError(messageFor(err, "credentials"));
      setPending(false);
    }
  }

  async function choosePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!link || !linkToken) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    const weak = password.length < OWNER_PASSWORD_MIN || !/\d/.test(password);
    setError(null);
    setPasswordError(weak ? t("link.rules", { min: OWNER_PASSWORD_MIN }) : undefined);
    setRepeatError(!weak && password !== repeat ? t("link.mismatch") : undefined);
    if (weak || password !== repeat) {
      const box = event.currentTarget;
      requestAnimationFrame(() => box.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setPending(true);
    try {
      const outcome = await apiPost<OwnerAuthOut>(
        link === "invite" ? "/auth/owner/invite/accept" : "/auth/owner/reset",
        { token: linkToken, password },
      );
      // The link has done its work: the password is set.
      forgetFragmentParam("token");
      await follow(outcome);
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      const problem = linkProblem(code, link);
      if (problem) {
        forgetFragmentParam("token");
        setLinkFailure(problem);
      }
      else if (code === "password_weak") setPasswordError(t("link.rules", { min: OWNER_PASSWORD_MIN }));
      else setError(messageFor(err, "credentials"));
      setPending(false);
    }
  }

  async function sendCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step.kind !== "mfa" && step.kind !== "setup") return;
    const code = String(new FormData(event.currentTarget).get("code") ?? "").replace(/\s+/g, "");
    setError(null);
    setPending(true);
    try {
      if (step.kind === "mfa") {
        await follow(
          await apiPost<OwnerAuthOut>("/auth/owner/mfa/verify", { mfa_token: step.token, code }),
        );
      } else {
        const enabled = await apiPost<MfaEnabledOut>("/auth/owner/mfa/confirm", {
          mfa_token: step.token,
          code,
        });
        setStep({ kind: "recovery", codes: enabled.recovery_codes });
        setPending(false);
      }
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      setError(messageFor(err, "code"));
      if (START_AGAIN.has(code)) startOver(false);
      setPending(false);
      codeInput.current?.select();
    }
  }

  /** Back to the email and password. From an emailed link the password is already chosen, so
   *  that is the sign-in page. */
  function startOver(clear = true) {
    if (clear) setError(null);
    if (link) router.push("/login");
    else setStep({ kind: "credentials" });
  }

  const title = step.kind === "password" && link ? t(`link.${link}.title`) : t("title");
  const lead =
    step.kind === "mfa"
      ? t("mfa.lead")
      : step.kind === "setup"
        ? t("setup.lead")
        : step.kind === "recovery"
          ? t("recovery.lead")
          : step.kind === "password" && link
            ? t(`link.${link}.lead`)
            : t("lead");

  return (
    <>
      <h1 className="text-3xl font-black">{title}</h1>
      <p className="mt-1 text-sm text-muted">{lead}</p>
      {signedOut && step.kind === "credentials" ? (
        <Alert kind="info" className="mt-4">
          {t("signedOut")}
        </Alert>
      ) : null}

      {step.kind === "credentials" ? (
        <form onSubmit={(event) => void signIn(event)} className="mt-6 flex flex-col gap-4">
          <Field
            label={t("email")}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            disabled={pending}
          />

          <div className="flex flex-col gap-1">
            <PasswordInput
              label={t("password")}
              showLabel={t("showPassword")}
              name="password"
              autoComplete="current-password"
              required
              disabled={pending}
            />
            <Link
              href="/forgot"
              className="inline-flex min-h-11 items-center self-end text-sm font-extrabold text-brand-ink underline-offset-2 hover:underline"
            >
              {t("forgot")}
            </Link>
          </div>

          {error ? <Alert kind="error">{error}</Alert> : null}

          <Button type="submit" size="form" fullWidth loading={pending}>
            {t("submit")}
          </Button>
        </form>
      ) : null}

      {step.kind === "password" && link ? (
        linkFailure ? (
          <LinkRefused link={link} problem={linkFailure} />
        ) : linkToken === null ? (
          <div className="mt-6 flex flex-col gap-4">
            <Alert kind="error">{t("link.noToken")}</Alert>
            <LinkWayOn link={link} />
          </div>
        ) : (
          <form onSubmit={(event) => void choosePassword(event)} className="mt-6 flex flex-col gap-4" noValidate>
            <PasswordInput
              label={t("link.password")}
              showLabel={t("showPassword")}
              name="password"
              autoComplete="new-password"
              onChange={() => setPasswordError(undefined)}
              hint={passwordError ? undefined : t("link.rules", { min: OWNER_PASSWORD_MIN })}
              error={passwordError}
              maxLength={128}
              required
              disabled={pending || linkToken === undefined}
            />
            <PasswordInput
              label={t("link.repeat")}
              showLabel={t("showPassword")}
              name="repeat"
              autoComplete="new-password"
              onChange={() => setRepeatError(undefined)}
              error={repeatError}
              maxLength={128}
              required
              disabled={pending || linkToken === undefined}
            />

            {error ? <Alert kind="error">{error}</Alert> : null}

            <Button type="submit" size="form" fullWidth loading={pending} disabled={linkToken === undefined}>
              {t(`link.${link}.submit`)}
            </Button>
          </form>
        )
      ) : null}

      {step.kind === "setup" ? (
        <section aria-labelledby={`${codeId}-setup`} className="mt-6 flex flex-col gap-4">
          <h2
            id={`${codeId}-setup`}
            ref={stepHeading}
            tabIndex={-1}
            className="text-lg font-extrabold tracking-normal"
          >
            {t("setup.title")}
          </h2>
          <ol className="flex list-decimal flex-col gap-3 pl-5 text-sm">
            <li>
              <p>{t("setup.scan")}</p>
              <div className="mt-2">
                <QrCode uri={step.setup.otpauth_uri} label={t("setup.qrLabel")} size={180} />
              </div>
              <p className="mt-2">{t("setup.onPhone")}</p>
              <OpenInApp uri={step.setup.otpauth_uri}>{t("setup.openApp")}</OpenInApp>
            </li>
            <li>
              <p>{t("setup.typeKey")}</p>
              <div className="mt-1.5">
                <SecretKey secret={step.setup.secret} copyLabel={t("setup.copyKey")} copied={t("copied")} />
              </div>
            </li>
            <li>{t("setup.enterCode")}</li>
          </ol>
        </section>
      ) : null}

      {step.kind === "mfa" || step.kind === "setup" ? (
        <form onSubmit={(event) => void sendCode(event)} className="mt-5 flex flex-col gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={codeId}>{step.kind === "mfa" ? t("mfa.code") : t("setup.code")}</Label>
            <input
              ref={codeInput}
              id={codeId}
              name="code"
              type="text"
              // A recovery code has letters in it; the code from the app is digits only.
              inputMode={step.kind === "mfa" ? "text" : "numeric"}
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={step.kind === "mfa" ? 24 : 8}
              required
              disabled={pending}
              aria-describedby={`${codeId}-hint`}
              aria-invalid={error ? true : undefined}
              className={cx(inputClass, "font-mono tracking-widest")}
            />
            <p id={`${codeId}-hint`} className="text-caption text-muted">
              {step.kind === "mfa" ? t("mfa.hint") : t("setup.hint")}
            </p>
          </div>

          {error ? <Alert kind="error">{error}</Alert> : null}

          <Button type="submit" size="form" fullWidth loading={pending}>
            {step.kind === "mfa" ? t("mfa.submit") : t("setup.submit")}
          </Button>
          <Button type="button" variant="ghost" size="console" onClick={() => startOver()} disabled={pending}>
            {t("startOver")}
          </Button>
        </form>
      ) : null}

      {step.kind === "recovery" ? (
        <section aria-labelledby={`${codeId}-recovery`} className="mt-6 flex flex-col gap-4">
          <h2
            id={`${codeId}-recovery`}
            ref={stepHeading}
            tabIndex={-1}
            className="text-lg font-extrabold tracking-normal"
          >
            {t("recovery.title")}
          </h2>
          <RecoveryCodes
            codes={step.codes}
            labels={{
              copy: t("recovery.copy"),
              download: t("recovery.download"),
              copied: t("copied"),
              fileName: t("recovery.fileName"),
              fileHeading: t("recovery.fileHeading"),
            }}
          />
          <Button type="button" size="form" fullWidth loading={leaving} onClick={finish}>
            {t("recovery.continue")}
          </Button>
        </section>
      ) : null}
    </>
  );
}

/** What a refused link means and the way on: sign in when it was used, ask again when a
 *  reset link has run out. */
function LinkRefused({
  link,
  problem,
}: {
  link: OwnerLink;
  problem: NonNullable<ReturnType<typeof linkProblem>>;
}) {
  const t = useTranslations("login.link");
  const message =
    problem === "expired"
      ? t(`${link}.expired`)
      : problem === "used"
        ? t(`${link}.used`)
        : problem === "wrongTenant"
          ? t("wrongTenant")
          : t("invalid");
  return (
    <div className="mt-6 flex flex-col gap-4">
      <Alert kind="error">{message}</Alert>
      <LinkWayOn link={link} />
    </div>
  );
}

function LinkWayOn({ link }: { link: OwnerLink }) {
  const t = useTranslations("login.link");
  const linkClass = buttonClass({ variant: "secondary", size: "console" });
  return (
    <div className="flex flex-wrap gap-2.5">
      <Link href="/login" className={linkClass}>
        {t("signIn")}
      </Link>
      {link === "reset" ? (
        <Link href="/forgot" className={linkClass}>
          {t("askAgain")}
        </Link>
      ) : null}
    </div>
  );
}
