"use client";

import type { Schemas } from "@crewstars/api-client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { OpenInApp, QrCode, RecoveryCodes, SecretKey } from "@/components/auth/MfaParts";
import { PasswordInput } from "@/components/auth/PasswordInput";
import { Alert, Button, buttonClass, cx, Field, inputClass, Label } from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { forgetFragmentParam, useFragmentParam } from "@/lib/fragment";
import { lockMinutes } from "@/lib/lockout";

type PlatformAuthOut = Schemas["PlatformAuthOut"];
type MfaSetupOut = Schemas["MfaSetupOut"];
type PlatformMfaEnabledOut = Schemas["PlatformMfaEnabledOut"];

/** The API's rule for a back office password (P7): longer than an owner's, with a number. */
export const PLATFORM_PASSWORD_MIN = 12;

/** Every refusal of the credentials themselves reads the same, so the form never says which
 *  half was wrong. */
const WRONG_CREDENTIALS = new Set(["credentials_invalid", "unauthorized", "http_401"]);
const WRONG_CODE = new Set(["credentials_invalid", "mfa_invalid", "unauthorized", "http_401"]);
/** The code step can no longer go on (its short-lived token ran out, the account was locked
 *  or switched off): start again from the email and password. */
const START_AGAIN = new Set([
  "account_locked",
  "account_inactive",
  "token_expired",
  "token_invalid",
  "token_used",
  "token_wrong_kind",
  "mfa_not_set_up",
]);

type Step =
  | { kind: "invite" }
  | { kind: "credentials" }
  | { kind: "mfa"; token: string }
  | { kind: "setup"; token: string; setup: MfaSetupOut }
  | { kind: "recovery"; codes: string[] };

type InviteProblem = "expired" | "used" | "invalid";

/**
 * Back office sign-in (P7), on admin.<base>. Every admin has a second factor, always: the API
 * answers a password with `mfa` (a code from the authenticator app, or a recovery code) or, the
 * first time, `mfa_setup` - a QR code to scan (drawn here from the `otpauth://` URI), the key
 * as text for when it cannot be scanned, a first code to prove it works, then the eight
 * recovery codes, shown once, to copy or download.
 *
 * With `invite` it is the page a colleague's invite email opens (`/invite#token=…`): a password
 * first (12 characters or more, with a number), then the same authenticator steps.
 *
 * Every step that finishes a sign-in is a token call in the BFF (app/api/[...path]/route.ts),
 * which keeps the tokens in the back office's own httpOnly cookies; none reaches this page.
 */
export function PlatformSignIn({
  next,
  invite = false,
  notice,
}: {
  next: string;
  invite?: boolean;
  /** Why they are here again: the session went idle, or ended. */
  notice?: React.ReactNode;
}) {
  const t = useTranslations("platform.signIn");
  const tl = useTranslations("login");
  const te = useTranslations("errors");
  const router = useRouter();
  const codeId = useId();
  const [step, setStep] = useState<Step>(invite ? { kind: "invite" } : { kind: "credentials" });
  const inviteToken = useFragmentParam(invite ? "token" : null);
  const [error, setError] = useState<string | null>(null);
  const [inviteProblem, setInviteProblem] = useState<InviteProblem | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [repeatError, setRepeatError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);

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
      return code === "account_locked" ? tl("lockedFor", { minutes }) : tl("rateLimitedFor", { minutes });
    }
    if (stage === "code" && WRONG_CODE.has(code)) return te("mfa_invalid");
    if (WRONG_CREDENTIALS.has(code)) return te("credentials_invalid");
    if (code === "account_inactive") return t("inactive");
    return te.has(code) ? te(code) : te("generic");
  }

  function finish() {
    setLeaving(true);
    router.replace(next);
    router.refresh();
  }

  async function follow(outcome: PlatformAuthOut) {
    if (outcome.step === "done") return finish();
    const token = outcome.mfa_token ?? "";
    if (outcome.step === "mfa") {
      setStep({ kind: "mfa", token });
      setPending(false);
      return;
    }
    const setup = await apiPost<MfaSetupOut>("/auth/platform/mfa/setup", { mfa_token: token });
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
        await apiPost<PlatformAuthOut>("/auth/platform/login", {
          email: String(form.get("email") ?? "").trim(),
          password: String(form.get("password") ?? ""),
        }),
      );
    } catch (err) {
      setError(messageFor(err, "credentials"));
      setPending(false);
    }
  }

  async function acceptInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inviteToken) return;
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const repeat = String(form.get("repeat") ?? "");
    const weak = password.length < PLATFORM_PASSWORD_MIN || !/\d/.test(password);
    setError(null);
    setPasswordError(weak ? t("invite.rules", { min: PLATFORM_PASSWORD_MIN }) : undefined);
    setRepeatError(!weak && password !== repeat ? t("invite.mismatch") : undefined);
    if (weak || password !== repeat) {
      const box = event.currentTarget;
      requestAnimationFrame(() => box.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setPending(true);
    try {
      const outcome = await apiPost<PlatformAuthOut>("/auth/platform/invite/accept", { token: inviteToken, password });
      // The invite has done its work: the password is set.
      forgetFragmentParam("token");
      await follow(outcome);
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      const problem: InviteProblem | null =
        code === "token_expired"
          ? "expired"
          : code === "token_used"
            ? "used"
            : code === "token_invalid" || code === "token_wrong_kind" || code === "account_inactive"
              ? "invalid"
              : null;
      if (problem) {
        // Refused for good: this link will not work again.
        forgetFragmentParam("token");
        setInviteProblem(problem);
      } else if (code === "password_weak") setPasswordError(t("invite.rules", { min: PLATFORM_PASSWORD_MIN }));
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
        await follow(await apiPost<PlatformAuthOut>("/auth/platform/mfa/verify", { mfa_token: step.token, code }));
      } else {
        const enabled = await apiPost<PlatformMfaEnabledOut>("/auth/platform/mfa/confirm", {
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

  /** Back to the email and password: on the invite page, that is the sign-in page. */
  function startOver(clear = true) {
    if (clear) setError(null);
    if (invite) router.push("/login");
    else setStep({ kind: "credentials" });
  }

  const heading =
    step.kind === "invite"
      ? t("invite.title")
      : step.kind === "mfa"
        ? t("mfa.title")
        : step.kind === "setup"
          ? t("setup.title")
          : step.kind === "recovery"
            ? t("recovery.title")
            : t("title");
  const lead =
    step.kind === "invite"
      ? t("invite.lead", { min: PLATFORM_PASSWORD_MIN })
      : step.kind === "mfa"
        ? t("mfa.lead")
        : step.kind === "setup"
          ? t("setup.lead")
          : step.kind === "recovery"
            ? t("recovery.lead")
            : t("lead");

  return (
    <>
      <h1 ref={stepHeading} tabIndex={-1} className="text-3xl font-black">
        {heading}
      </h1>
      <p className="mt-1 text-sm text-muted">{lead}</p>
      {notice && step.kind === "credentials" ? <div className="mt-4">{notice}</div> : null}

      {step.kind === "credentials" ? (
        <form onSubmit={(event) => void signIn(event)} className="mt-6 flex flex-col gap-4">
          <Field
            label={tl("email")}
            name="email"
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            disabled={pending}
          />
          <PasswordInput
            label={tl("password")}
            showLabel={tl("showPassword")}
            name="password"
            autoComplete="current-password"
            required
            disabled={pending}
          />
          {error ? <Alert kind="error">{error}</Alert> : null}
          <Button type="submit" size="form" fullWidth loading={pending}>
            {t("submit")}
          </Button>
        </form>
      ) : null}

      {step.kind === "invite" ? (
        inviteProblem ? (
          <div className="mt-6 flex flex-col gap-4">
            <Alert kind="error">{t(`invite.${inviteProblem}`)}</Alert>
            <Link href="/login" className={buttonClass({ variant: "secondary", size: "console" })}>
              {t("invite.signIn")}
            </Link>
          </div>
        ) : inviteToken === null ? (
          <div className="mt-6 flex flex-col gap-4">
            <Alert kind="error">{t("invite.noToken")}</Alert>
            <Link href="/login" className={buttonClass({ variant: "secondary", size: "console" })}>
              {t("invite.signIn")}
            </Link>
          </div>
        ) : (
          <form onSubmit={(event) => void acceptInvite(event)} className="mt-6 flex flex-col gap-4" noValidate>
            <PasswordInput
              label={t("invite.password")}
              showLabel={tl("showPassword")}
              name="password"
              autoComplete="new-password"
              onChange={() => setPasswordError(undefined)}
              hint={passwordError ? undefined : t("invite.rules", { min: PLATFORM_PASSWORD_MIN })}
              error={passwordError}
              maxLength={128}
              required
              disabled={pending || inviteToken === undefined}
            />
            <PasswordInput
              label={t("invite.repeat")}
              showLabel={tl("showPassword")}
              name="repeat"
              autoComplete="new-password"
              onChange={() => setRepeatError(undefined)}
              error={repeatError}
              maxLength={128}
              required
              disabled={pending || inviteToken === undefined}
            />
            {error ? <Alert kind="error">{error}</Alert> : null}
            <Button type="submit" size="form" fullWidth loading={pending} disabled={inviteToken === undefined}>
              {t("invite.submit")}
            </Button>
          </form>
        )
      ) : null}

      {step.kind === "setup" ? (
        <ol className="mt-6 flex list-decimal flex-col gap-4 pl-5 text-sm">
          <li>
            <p>{t("setup.scan")}</p>
            <div className="mt-2">
              <QrCode uri={step.setup.otpauth_uri} label={t("setup.qrLabel")} />
            </div>
            <p className="mt-2">{t("setup.onPhone")}</p>
            <OpenInApp uri={step.setup.otpauth_uri}>{t("setup.openApp")}</OpenInApp>
          </li>
          <li>
            <p>{t("setup.typeKey")}</p>
            <div className="mt-1.5">
              <SecretKey secret={step.setup.secret} copyLabel={t("setup.copyKey")} copied={tl("copied")} />
            </div>
          </li>
          <li>{t("setup.enterCode")}</li>
        </ol>
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
            {tl("startOver")}
          </Button>
        </form>
      ) : null}

      {step.kind === "recovery" ? (
        <div className="mt-6 flex flex-col gap-4">
          <RecoveryCodes
            codes={step.codes}
            labels={{
              copy: tl("recovery.copy"),
              download: tl("recovery.download"),
              copied: tl("copied"),
              fileName: t("recovery.fileName"),
              fileHeading: t("recovery.fileHeading"),
            }}
          />
          <Button type="button" size="form" fullWidth loading={leaving} onClick={finish}>
            {tl("recovery.continue")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
