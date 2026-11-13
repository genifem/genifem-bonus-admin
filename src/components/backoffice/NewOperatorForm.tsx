"use client";

import type { Schemas } from "@crewstars/api-client";
import { Building2, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";

import { Panel } from "@/components/recognition/Panel";
import {
  Button,
  Columns,
  cx,
  Field,
  fieldFocusWithin,
  fieldInvalidWithin,
  FieldMessage,
  Label,
  SelectField,
} from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { RESERVED_SLUGS, SLUG_MAX, suggestSlug } from "@/lib/slug";

import {
  checkOperator,
  fieldsOfRefusal,
  NAME_MAX,
  operatorBody,
  timeZoneChoices,
  TIME_ZONES,
  type DraftField,
  type OperatorDraft,
} from "./operator-form";
import { ReasonDialog } from "./ReasonDialog";

type OperatorCreatedOut = Schemas["OperatorCreatedOut"];

/**
 * New operator (P7): the company - its name, its address (the slug: `{slug}.<base>`, also the
 * company code people type in the app) and its time zone - and its first owner, who is emailed
 * an invite. The address follows the name until someone types their own, and says what is
 * wrong with it as it is typed: the characters it may hold, its length, and the addresses that
 * are ours (the reserved list, shown under it).
 *
 * "Create operator" asks for the reason every back office write gives (ReasonDialog), then
 * POST /platform/operators. The API makes the settings and rewards with the defaults and sends
 * the invite; the operator's page opens next, with the steps that put its address online and
 * how the invite email went. An address that is taken, or anything else the API refuses about
 * a field, goes back beside that field.
 */
export function NewOperatorForm({ baseDomain }: { baseDomain: string }) {
  const t = useTranslations("platform.newOperator");
  const tLang = useTranslations("common.languages");
  const locale = useLocale();
  const router = useRouter();
  const slugId = useId();
  const form = useRef<HTMLFormElement>(null);
  const [draft, setDraft] = useState<OperatorDraft>({
    name: "",
    slug: "",
    tz: TIME_ZONES[0],
    ownerName: "",
    ownerEmail: "",
    ownerLanguage: locale === "es" ? "es" : "en",
  });
  const [slugTyped, setSlugTyped] = useState(false);
  const [tried, setTried] = useState(false);
  const [refused, setRefused] = useState<Partial<Record<DraftField, string>>>({});
  const [confirming, setConfirming] = useState(false);
  /** Bumped when the form comes back with problems, so focus moves to the first of them. */
  const [attempt, setAttempt] = useState(0);
  const zones = useMemo(() => timeZoneChoices(locale), [locale]);

  useEffect(() => {
    if (attempt > 0) form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [attempt]);

  const problems = checkOperator(draft);
  const problemOf = (field: DraftField) => problems.find((problem) => problem.field === field)?.problem;

  function set<K extends keyof OperatorDraft>(key: K, value: OperatorDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      // The address follows the name until someone types one of their own.
      if (key === "name" && !slugTyped) next.slug = suggestSlug(String(value));
      return next;
    });
    setRefused((current) => {
      const next = { ...current };
      delete next[key];
      if (key === "name" && !slugTyped) delete next.slug;
      return next;
    });
  }

  /** The words for a field's problem: the API's when it refused one, else the form's own
   *  (shown once Create has been pressed, or at once for an address being typed). */
  function errorOf(field: DraftField): string | undefined {
    const fromApi = refused[field];
    if (fromApi) return t(`problems.${field}.${fromApi}`);
    const own = problemOf(field);
    if (!own) return undefined;
    // An address is checked as it is typed; an empty one waits, like the rest, for Create.
    const live = field === "slug" && own !== "empty";
    return tried || live ? t(`problems.${field}.${own}`) : undefined;
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTried(true);
    if (problems.length > 0 || Object.keys(refused).length > 0) {
      setAttempt((n) => n + 1);
      return;
    }
    setConfirming(true);
  }

  async function create(reason: string) {
    try {
      const created = await apiPost<OperatorCreatedOut>("/platform/operators", operatorBody(draft, reason));
      router.push(`/operators/${created.operator.id}?created=1&invite=${created.invite_email}`);
    } catch (err) {
      const fields = err instanceof ApiCallError ? fieldsOfRefusal(err.code, err.details) : null;
      // About a field: the dialog closes and the field says it. Anything else stays in the
      // dialog, which shows it.
      if (!fields) throw err;
      setRefused(fields);
      setAttempt((n) => n + 1);
    }
  }

  const slugError = errorOf("slug");
  const host = `${draft.slug || t("slugPlaceholder")}.${baseDomain}`;

  return (
    <>
      <form ref={form} onSubmit={submit} noValidate className="flex flex-col gap-section">
        <Columns layout="halves">
          <Panel id="company-heading" title={t("company.title")} icon={Building2} lead={t("company.lead")}>
            <div className="flex flex-col gap-4">
              <Field
                label={t("company.name")}
                name="name"
                value={draft.name}
                onChange={(event) => set("name", event.target.value)}
                maxLength={NAME_MAX}
                autoComplete="organization"
                error={errorOf("name")}
                required
              />

              <div className="flex min-w-0 flex-col gap-1.5">
                <Label htmlFor={slugId}>{t("company.slug")}</Label>
                <div
                  className={cx(
                    "flex h-control min-w-0 items-stretch overflow-hidden rounded-(--control-radius) border border-control-border bg-surface-raised",
                    "transition-[border-color,box-shadow] duration-fast ease-standard",
                    fieldFocusWithin,
                    fieldInvalidWithin,
                  )}
                >
                  <input
                    id={slugId}
                    name="slug"
                    value={draft.slug}
                    onChange={(event) => {
                      setSlugTyped(true);
                      set("slug", event.target.value.toLowerCase().replace(/\s+/g, "-"));
                    }}
                    maxLength={SLUG_MAX + 8}
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    translate="no"
                    aria-describedby={`${slugId}-message ${slugId}-rules`}
                    aria-invalid={slugError ? true : undefined}
                    className="min-w-0 flex-1 bg-transparent px-(--control-px) font-mono text-(length:--control-text) text-foreground outline-none placeholder:text-muted"
                  />
                  <span
                    aria-hidden="true"
                    translate="no"
                    className="flex max-w-[55%] shrink-0 items-center truncate border-l border-border bg-surface px-3 font-mono text-sm text-muted"
                  >
                    .{baseDomain}
                  </span>
                </div>
                <FieldMessage
                  id={`${slugId}-message`}
                  hint={slugError ? undefined : t("company.slugHint", { host })}
                  error={slugError}
                />
                <p id={`${slugId}-rules`} className="text-caption text-muted">
                  {t("company.slugRules", { max: SLUG_MAX })}{" "}
                  <span className="font-semibold">{t("company.reserved")}</span>{" "}
                  <span translate="no" className="font-mono">
                    {RESERVED_SLUGS.join(", ")}
                  </span>
                </p>
              </div>

              <SelectField
                label={t("company.tz")}
                name="tz"
                value={draft.tz}
                onChange={(event) => set("tz", event.target.value)}
                hint={t("company.tzHint")}
                error={errorOf("tz")}
              >
                {zones.map((zone) => (
                  <option key={zone.value} value={zone.value}>
                    {zone.label}
                  </option>
                ))}
              </SelectField>
            </div>
          </Panel>

          <Panel id="owner-heading" title={t("owner.title")} icon={UserRound} lead={t("owner.lead")}>
            <div className="flex flex-col gap-4">
              <Field
                label={t("owner.name")}
                name="ownerName"
                value={draft.ownerName}
                onChange={(event) => set("ownerName", event.target.value)}
                maxLength={NAME_MAX}
                autoComplete="off"
                error={errorOf("ownerName")}
                required
              />
              <Field
                label={t("owner.email")}
                name="ownerEmail"
                type="email"
                inputMode="email"
                value={draft.ownerEmail}
                onChange={(event) => set("ownerEmail", event.target.value)}
                maxLength={254}
                autoComplete="off"
                error={errorOf("ownerEmail")}
                hint={t("owner.emailHint")}
                required
              />
              <SelectField
                label={t("owner.language")}
                name="ownerLanguage"
                value={draft.ownerLanguage}
                onChange={(event) => set("ownerLanguage", event.target.value === "es" ? "es" : "en")}
                hint={t("owner.languageHint")}
              >
                <option value="en">{tLang("en")}</option>
                <option value="es">{tLang("es")}</option>
              </SelectField>
            </div>
          </Panel>
        </Columns>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <p className="w-full text-sm text-muted sm:w-auto sm:min-w-0 sm:flex-1">{t("defaults")}</p>
          <Button type="button" variant="secondary" size="console" onClick={() => router.push("/operators")}>
            {t("cancel")}
          </Button>
          <Button type="submit" size="console">
            {t("submit")}
          </Button>
        </div>
      </form>

      {/* Beside the form, not in it: the dialog holds a form of its own. */}
      {confirming ? (
        <ReasonDialog
          title={t("confirm.title")}
          subtitle={t("confirm.subtitle", { name: draft.name.trim(), host: `${draft.slug}.${baseDomain}` })}
          confirmLabel={t("submit")}
          notice={<p className="text-sm text-muted">{t("confirm.notice", { email: draft.ownerEmail.trim() })}</p>}
          onConfirm={(reason) => create(reason)}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </>
  );
}
