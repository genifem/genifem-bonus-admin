"use client";

import type { Schemas } from "@crewstars/api-client";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";

import { CheckboxField, Field, FieldMessage, SelectField, cx } from "@/components/ui";
import { apiPatch, apiPost } from "@/lib/api";

import {
  createBody,
  draftFrom,
  patchBody,
  PLACEMENT_FIELD,
  placementOf,
  type PersonDraft,
} from "./person-form";
import { ROLES, type Role } from "./roster-query";
import { FormProblems, RecordDialog, useProblems } from "./RosterBits";

type PersonOut = Schemas["PersonOut"];
type StoreOut = Schemas["StoreOut"];
type AreaOut = Schemas["AreaOut"];

const BASE_FIELDS = ["eid", "name", "role", "phone", "hire_date", "language"] as const;

const storeLabel = (store: Pick<StoreOut, "number" | "name">) => `${store.number} · ${store.name}`;

/**
 * Add someone, or change them (OP roster, plan G1): who they are, their role and where it
 * puts them, their phone for the setup text, their hire date and language.
 *
 * Where they work follows the role, as the API decides it: one store for crew, shift managers
 * and GMs, several for a supervisor, an area for a director. A closed store is not offered,
 * unless it is where they already are.
 *
 * Mount it with a `key` per opening, so each one starts from the person (or a blank form).
 */
export function PersonDialog({
  open,
  person,
  stores,
  areas,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** Null to add someone. */
  person: PersonOut | null;
  stores: readonly StoreOut[];
  areas: readonly AreaOut[];
  onClose: () => void;
  onSaved: (saved: PersonOut, created: boolean) => void;
}) {
  const t = useTranslations("roster.person");
  const tRoles = useTranslations("roster.roles");
  const tLang = useTranslations("common.languages");
  const formId = useId();
  const [draft, setDraft] = useState<PersonDraft>(() => draftFrom(person));
  const [busy, setBusy] = useState(false);
  const placement = placementOf(draft.role);
  const form = useRef<HTMLFormElement>(null);
  const problems = useProblems([...BASE_FIELDS, PLACEMENT_FIELD[placement]], form);

  const set = <K extends keyof PersonDraft>(key: K, value: PersonDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const current = new Set([person?.store?.id, ...(person?.stores ?? []).map((store) => store.id)]);
  const offered = stores.filter((store) => store.active || current.has(store.id));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    problems.clear();
    const patch = person ? patchBody(person, draft) : null;
    // Nothing changed: there is nothing to save, so it is simply done.
    if (patch && Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      const saved =
        person && patch
          ? await apiPatch<PersonOut>(`/portal/people/${person.id}`, patch)
          : await apiPost<PersonOut>("/portal/people", createBody(draft));
      setBusy(false);
      onSaved(saved, person === null);
    } catch (err) {
      setBusy(false);
      problems.fail(err);
    }
  }

  const storesError = problems.fieldError("store_ids");

  return (
    <RecordDialog
      open={open}
      title={person ? t("editTitle", { name: person.name }) : t("addTitle")}
      description={person ? undefined : t("addLead")}
      formId={formId}
      saveLabel={person ? t("save") : t("add")}
      busy={busy}
      onClose={onClose}
    >
      <form id={formId} ref={form} onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
        <Field
          label={t("name")}
          name="name"
          value={draft.name}
          onChange={(event) => set("name", event.target.value)}
          error={problems.fieldError("name")}
          autoComplete="off"
          maxLength={80}
          required
        />
        <Field
          label={t("eid")}
          hint={t("eidHint")}
          name="eid"
          value={draft.eid}
          onChange={(event) => set("eid", event.target.value)}
          error={problems.fieldError("eid")}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={32}
          required
        />
        <SelectField
          label={t("role")}
          value={draft.role}
          onChange={(event) => set("role", event.target.value as Role)}
          error={problems.fieldError("role")}
        >
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {tRoles(role)}
            </option>
          ))}
        </SelectField>

        {placement === "store" ? (
          <SelectField
            label={t("store")}
            hint={draft.role === "gm" ? t("storeGmHint") : undefined}
            value={draft.storeId}
            onChange={(event) => set("storeId", event.target.value)}
            error={problems.fieldError("store_id")}
            required
          >
            <option value="">{t("chooseStore")}</option>
            {offered.map((store) => (
              <option key={store.id} value={store.id}>
                {store.active ? storeLabel(store) : t("closedStore", { store: storeLabel(store) })}
              </option>
            ))}
          </SelectField>
        ) : null}

        {placement === "stores" ? (
          <fieldset aria-describedby={`${formId}-stores-message`} className="flex min-w-0 flex-col gap-1.5">
            <legend className="text-sm font-bold">{t("stores")}</legend>
            <div
              className={cx(
                "mt-1.5 max-h-56 overflow-y-auto rounded-(--control-radius) border px-3 py-1",
                storesError ? "border-danger" : "border-control-border",
              )}
            >
              {offered.length === 0 ? (
                <p className="py-2.5 text-sm text-muted">{t("noStores")}</p>
              ) : (
                offered.map((store) => (
                  <CheckboxField
                    key={store.id}
                    label={store.active ? storeLabel(store) : t("closedStore", { store: storeLabel(store) })}
                    checked={draft.storeIds.includes(store.id)}
                    onChange={(event) =>
                      set(
                        "storeIds",
                        event.target.checked
                          ? [...draft.storeIds, store.id]
                          : draft.storeIds.filter((id) => id !== store.id),
                      )
                    }
                  />
                ))
              )}
            </div>
            <FieldMessage id={`${formId}-stores-message`} hint={t("storesHint")} error={storesError} />
          </fieldset>
        ) : null}

        {placement === "area" ? (
          <SelectField
            label={t("area")}
            value={draft.areaId}
            onChange={(event) => set("areaId", event.target.value)}
            error={problems.fieldError("area_id")}
            required
          >
            <option value="">{t("chooseArea")}</option>
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </SelectField>
        ) : null}

        <Field
          label={t("phone")}
          hint={
            person?.phone_masked
              ? t("phoneOnFile", { phone: person.phone_masked })
              : t("phoneHint")
          }
          name="phone"
          type="tel"
          inputMode="tel"
          value={draft.phone}
          onChange={(event) => set("phone", event.target.value)}
          error={problems.fieldError("phone")}
          disabled={draft.removePhone}
          autoComplete="off"
          maxLength={32}
        />
        {person?.phone_masked ? (
          <CheckboxField
            label={t("removePhone")}
            checked={draft.removePhone}
            onChange={(event) => set("removePhone", event.target.checked)}
          />
        ) : null}

        <Field
          label={t("hireDate")}
          name="hire_date"
          type="date"
          value={draft.hireDate}
          onChange={(event) => set("hireDate", event.target.value)}
          error={problems.fieldError("hire_date")}
        />
        <SelectField
          label={t("language")}
          hint={t("languageHint")}
          value={draft.language}
          onChange={(event) => set("language", event.target.value as PersonDraft["language"])}
          error={problems.fieldError("language")}
        >
          <option value="en">{tLang("en")}</option>
          <option value="es">{tLang("es")}</option>
        </SelectField>

        <FormProblems messages={problems.general} />
      </form>
    </RecordDialog>
  );
}
