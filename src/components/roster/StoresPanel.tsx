"use client";

import type { Schemas } from "@crewstars/api-client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";

import {
  Badge,
  Button,
  DataTable,
  EmptyState,
  Field,
  SelectField,
  Toggle,
  useToast,
  VisuallyHidden,
  type Column,
} from "@/components/ui";
import { apiPatch, apiPost } from "@/lib/api";

import { storeCreateBody, storeDraft, storePatchBody, type StoreDraft } from "./org-form";
import { FormProblems, RecordDialog, TimeZoneField, useProblems, useZoneLabel } from "./RosterBits";

type StoreOut = Schemas["StoreOut"];
type AreaOut = Schemas["AreaOut"];

const FIELDS = ["number", "name", "area_id", "tz", "active"] as const;

/**
 * The Stores tab: every store with its area, its GM and supervisor (who follow from the
 * people, never set by hand) and how many people work there; add a store or change one.
 * Closing a store someone still works at is refused (`store_has_people`).
 */
export function StoresPanel({ stores, areas }: { stores: readonly StoreOut[]; areas: readonly AreaOut[] }) {
  const t = useTranslations("roster.stores");
  const router = useRouter();
  const toast = useToast();
  const zone = useZoneLabel();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ store: StoreOut | null; round: number }>({ store: null, round: 0 });

  function edit(store: StoreOut | null) {
    setEditing((was) => ({ store, round: was.round + 1 }));
    setOpen(true);
  }

  function saved(store: StoreOut, created: boolean) {
    setOpen(false);
    toast.show(created ? t("added", { name: store.name }) : t("saved", { name: store.name }));
    router.refresh();
  }

  const none = <span className="text-muted">{t("none")}</span>;
  const columns: Column<StoreOut>[] = [
    {
      key: "number",
      header: t("columns.number"),
      overflow: "nowrap",
      cell: (store) => <span className="font-extrabold tabular-nums">{store.number}</span>,
    },
    { key: "name", header: t("columns.name"), overflow: "wrap", cell: (store) => store.name },
    { key: "area", header: t("columns.area"), cell: (store) => store.area?.name ?? none },
    { key: "gm", header: t("columns.gm"), overflow: "wrap", cell: (store) => store.gm?.name ?? none },
    {
      key: "supervisor",
      header: t("columns.supervisor"),
      overflow: "wrap",
      hideBelow: "md",
      cell: (store) => store.supervisor?.name ?? none,
    },
    { key: "people", header: t("columns.people"), align: "end", cell: (store) => store.people },
    {
      key: "tz",
      header: t("columns.tz"),
      hideBelow: "lg",
      cell: (store) => <span className="text-caption">{zone(store.tz)}</span>,
    },
    {
      key: "active",
      header: t("columns.active"),
      cell: (store) =>
        store.active ? <Badge tone="success">{t("open")}</Badge> : <Badge>{t("closed")}</Badge>,
    },
    {
      key: "actions",
      header: t("columns.actions"),
      width: "min",
      pin: "end",
      cell: (store) => (
        <Button variant="secondary" size="console" onClick={() => edit(store)}>
          {t("edit")}
          <VisuallyHidden>{` ${store.number} ${store.name}`}</VisuallyHidden>
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="stores-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="stores-heading" className="text-title font-black tracking-normal">
          {t("heading", { count: stores.length })}
        </h2>
        <Button size="console" icon={<Plus aria-hidden="true" className="size-4" strokeWidth={2} />} onClick={() => edit(null)}>
          {t("add")}
        </Button>
      </div>

      {stores.length === 0 ? (
        <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
      ) : (
        <DataTable caption={t("caption")} columns={columns} rows={stores} rowKey={(store) => store.id} />
      )}

      <StoreDialog
        key={editing.round}
        open={open}
        store={editing.store}
        areas={areas}
        onClose={() => setOpen(false)}
        onSaved={saved}
      />
    </section>
  );
}

function StoreDialog({
  open,
  store,
  areas,
  onClose,
  onSaved,
}: {
  open: boolean;
  store: StoreOut | null;
  areas: readonly AreaOut[];
  onClose: () => void;
  onSaved: (store: StoreOut, created: boolean) => void;
}) {
  const t = useTranslations("roster.stores");
  const formId = useId();
  const [draft, setDraft] = useState<StoreDraft>(() => storeDraft(store));
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const problems = useProblems(store ? FIELDS : FIELDS.filter((field) => field !== "active"), form);

  const set = <K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    problems.clear();
    const patch = store ? storePatchBody(store, draft) : null;
    if (patch && Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      const saved =
        store && patch
          ? await apiPatch<StoreOut>(`/portal/stores/${store.id}`, patch)
          : await apiPost<StoreOut>("/portal/stores", storeCreateBody(draft));
      setBusy(false);
      onSaved(saved, store === null);
    } catch (err) {
      setBusy(false);
      problems.fail(err);
    }
  }

  const activeError = problems.fieldError("active");

  return (
    <RecordDialog
      open={open}
      title={store ? t("editTitle", { number: store.number }) : t("addTitle")}
      formId={formId}
      saveLabel={store ? t("save") : t("addSubmit")}
      busy={busy}
      onClose={onClose}
    >
      <form id={formId} ref={form} onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
        <Field
          label={t("number")}
          hint={t("numberHint")}
          value={draft.number}
          onChange={(event) => set("number", event.target.value)}
          error={problems.fieldError("number")}
          autoComplete="off"
          maxLength={12}
          required
        />
        <Field
          label={t("name")}
          value={draft.name}
          onChange={(event) => set("name", event.target.value)}
          error={problems.fieldError("name")}
          autoComplete="off"
          maxLength={60}
          required
        />
        <SelectField
          label={t("area")}
          hint={t("areaHint")}
          value={draft.areaId}
          onChange={(event) => set("areaId", event.target.value)}
          error={problems.fieldError("area_id")}
        >
          <option value="">{t("noArea")}</option>
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </SelectField>
        <TimeZoneField value={draft.tz} onChange={(tz) => set("tz", tz)} error={problems.fieldError("tz")} />
        {store ? (
          <div className="flex flex-col gap-1">
            <Toggle
              checked={draft.active}
              onChange={(active) => set("active", active)}
              label={t("activeLabel")}
              description={t("activeHint")}
            />
            {activeError ? (
              <p role="alert" className="text-caption font-semibold text-danger-ink">
                {activeError}
              </p>
            ) : null}
          </div>
        ) : null}
        <FormProblems messages={problems.general} />
      </form>
    </RecordDialog>
  );
}
