"use client";

import type { Schemas } from "@crewstars/api-client";
import { Copy, Eye, EyeOff, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";

import { Alert, Button, Field, inputClass, Label, cx, useToast } from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { lockMinutes } from "@/lib/lockout";

type OwnerAuthOut = Schemas["OwnerAuthOut"];
type MfaSetupOut = Schemas["MfaSetupOut"];
type MfaEnabledOut = Schemas["MfaEnabledOut"];

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

type Step =
  | { kind: "credentials" }
  /** An authenticator code (or a recovery code) for an owner with the second factor on. */
  | { kind: "mfa"; token: string }
  /** The second factor is on for the portal but this owner has not set it up yet. */
  | { kind: "setup"; token: string; setup: MfaSetupOut }
  /** Shown once, straight after setting it up. The session is already open. */
  | { kind: "recovery"; codes: string[] };

/** "JBSW Y3DP EHPK 3PXP": a key read off a screen and typed into a phone. */
const grouped = (secret: string) => secret.match(/.{1,4}/g)?.join(" ") ?? secret;

/**
 * Owner sign-in (plan D8): email and password, posted through the BFF to
 * /api/v1/auth/owner/login, which keeps the tokens in httpOnly cookies.
 *
 * With the second factor switched on (CS_OWNER_MFA_ENABLED), the API answers with a step
 * instead of a session: `mfa` asks for a code from the authenticator app (or a recovery code),
 * `mfa_setup` for one to be set up first - a key to add to the app, a code from it to prove
 * it works, then the recovery codes, shown once. The steps that finish a sign-in
 * (mfa/verify, mfa/confirm) are token calls in the BFF too, so no token reaches this page.
 *
 * A refusal shows the API's code translated (`errors.<code>`), or the generic message for a
 * code the catalog does not know. A lockout, or too many tries from one place, says how long
 * it has left (CR-07).
 */
export function LoginForm({ next, signedOut = false }: { next: string; signedOut?: boolean }) {
  const t = useTranslations("login");
  const te = useTranslations("errors");
  const router = useRouter();
  const toast = useToast();
  const passwordId = useId();
  const codeId = useId();
  const [step, setStep] = useState<Step>({ kind: "credentials" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const codeInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  // A new step takes focus: straight into the code box when that is all there is to do, or to
  // the step's heading when there is something to read first.
  useEffect(() => {
    if (step.kind === "mfa") codeInput.current?.focus();
    else if (step.kind !== "credentials") stepHeading.current?.focus();
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
      if (START_AGAIN.has(code)) setStep({ kind: "credentials" });
      setPending(false);
      codeInput.current?.select();
    }
  }

  function startOver() {
    setError(null);
    setStep({ kind: "credentials" });
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.show(t("copied"));
    } catch {
      // Nothing to do: the text is on screen to copy by hand.
    }
  }

  const lead =
    step.kind === "mfa"
      ? t("mfa.lead")
      : step.kind === "setup"
        ? t("setup.lead")
        : step.kind === "recovery"
          ? t("recovery.lead")
          : t("lead");

  return (
    <>
      <h1 className="text-3xl font-black">{t("title")}</h1>
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

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={passwordId}>{t("password")}</Label>
            <div className="relative">
              <input
                id={passwordId}
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                disabled={pending}
                className={cx(inputClass, "pr-13")}
              />
              {/* A toggle with a fixed name: aria-pressed says whether the password is showing. */}
              <button
                type="button"
                aria-label={t("showPassword")}
                aria-pressed={showPassword}
                aria-controls={passwordId}
                onClick={() => setShowPassword((shown) => !shown)}
                className="absolute right-1 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted transition-colors duration-fast hover:bg-surface hover:text-foreground"
              >
                {showPassword ? (
                  <EyeOff aria-hidden="true" className="size-5" strokeWidth={2} />
                ) : (
                  <Eye aria-hidden="true" className="size-5" strokeWidth={2} />
                )}
              </button>
            </div>
          </div>

          {error ? <Alert kind="error">{error}</Alert> : null}

          <Button type="submit" size="form" fullWidth loading={pending} className="mt-1">
            {t("submit")}
          </Button>
        </form>
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
              <p>{t("setup.onPhone")}</p>
              <a
                href={step.setup.otpauth_uri}
                className="mt-1.5 inline-flex min-h-11 items-center gap-2 font-extrabold text-brand-ink underline underline-offset-2"
              >
                <KeyRound aria-hidden="true" className="size-4" strokeWidth={2} />
                {t("setup.openApp")}
              </a>
            </li>
            <li>
              <p>{t("setup.typeKey")}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <code
                  translate="no"
                  className="rounded-compact bg-surface px-3 py-2 font-mono text-sm font-bold tracking-wider break-all"
                >
                  {grouped(step.setup.secret)}
                </code>
                <Button
                  type="button"
                  variant="secondary"
                  size="console"
                  icon={<Copy aria-hidden="true" className="size-4" strokeWidth={2} />}
                  onClick={() => void copy(step.setup.secret)}
                >
                  {t("setup.copyKey")}
                </Button>
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
          <Button type="button" variant="ghost" size="console" onClick={startOver} disabled={pending}>
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
          <ul
            translate="no"
            className="grid grid-cols-2 gap-2 rounded-xl bg-surface p-3 font-mono text-sm font-bold tracking-wider"
          >
            {step.codes.map((code) => (
              <li key={code} className="text-center">
                {code}
              </li>
            ))}
          </ul>
          <Button
            type="button"
            variant="secondary"
            size="console"
            icon={<Copy aria-hidden="true" className="size-4" strokeWidth={2} />}
            onClick={() => void copy(step.codes.join("\n"))}
          >
            {t("recovery.copy")}
          </Button>
          <Button type="button" size="form" fullWidth loading={leaving} onClick={finish}>
            {t("recovery.continue")}
          </Button>
        </section>
      ) : null}
    </>
  );
}
