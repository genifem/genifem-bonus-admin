"use client";

import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useState, type FormEvent } from "react";

import { Alert, Button, Field, inputClass, Label, cx } from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";

/** Every way a sign-in can be refused for the credentials themselves reads the same, so the
 *  form never tells anyone which half was wrong. */
const WRONG_CREDENTIALS = new Set(["credentials_invalid", "unauthorized", "http_401"]);

/**
 * Owner sign-in (plan D8): email and password, posted through the BFF to
 * /api/v1/auth/owner/login, which keeps the tokens in httpOnly cookies. A refusal shows the
 * API's code translated (`errors.<code>`), or the generic message for a code the catalog does
 * not know.
 */
export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const te = useTranslations("errors");
  const router = useRouter();
  const passwordId = useId();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function messageFor(err: unknown): string {
    const code = err instanceof ApiCallError ? err.code : "generic";
    if (WRONG_CREDENTIALS.has(code)) return te("credentials_invalid");
    return te.has(code) ? te(code) : te("generic");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);
    try {
      await apiPost("/auth/owner/login", {
        email: String(form.get("email") ?? "").trim(),
        password: String(form.get("password") ?? ""),
      });
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(messageFor(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={(event) => void submit(event)} className="mt-6 flex flex-col gap-4">
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
  );
}
