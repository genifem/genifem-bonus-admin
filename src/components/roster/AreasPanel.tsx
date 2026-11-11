"use client";

import type { Schemas } from "@crewstars/api-client";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, type FormEvent } from "react";

import { Button, DataTable, EmptyState, Field, useToast, VisuallyHidden, type Column } from "@/components/ui";
import { apiPatch, apiPost } from "@/lib/api";

import { areaCreateBody, areaDraft, areaPatchBody, type AreaDraft } from "./org-form";
import { FormProblems, RecordDialog, TimeZoneField, useProblems, useZoneLabel } from "./RosterBits";

type AreaOut = Schemas["AreaOut"];

const FIELDS = ["name", "tz"] as const;

/**
 * The Areas tab: each area with its director (who follows from the people), how many open
 * stores it has, and its time zone, which supervisors and directors count their month in
 * (plan D7). Add an area or change one.
 */
export function AreasPanel({ areas }: { areas: readonly AreaOut[] }) {
  const t = useTranslations("roster.areas");
  const router = useRouter();
  const toast = useToast();
  const zone = useZoneLabel();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<{ area: AreaOut | null; round: number }>({ area: null, round: 0 });

  function edit(area: AreaOut | null) {
    setEditing((was) => ({ area, round: was.round + 1 }));
    setOpen(true);
  }

  function saved(area: AreaOut, created: boolean) {
    setOpen(false);
    toast.show(created ? t("added", { name: area.name }) : t("saved", { name: area.name }));
    router.refresh();
  }

  const columns: Column<AreaOut>[] = [
    {
      key: "name",
      header: t("columns.name"),
      overflow: "wrap",
      cell: (area) => <span className="font-extrabold">{area.name}</span>,
    },
    {
      key: "director",
      header: t("columns.director"),
      overflow: "wrap",
      cell: (area) => area.director?.name ?? <span className="text-muted">{t("none")}</span>,
    },
    { key: "stores", header: t("columns.stores"), align: "end", cell: (area) => area.stores },
    { key: "tz", header: t("columns.tz"), cell: (area) => <span className="text-caption">{zone(area.tz)}</span> },
    {
      key: "actions",
      header: t("columns.actions"),
      width: "min",
      pin: "end",
      cell: (area) => (
        <Button variant="secondary" size="console" onClick={() => edit(area)}>
          {t("edit")}
          <VisuallyHidden>{` ${area.name}`}</VisuallyHidden>
        </Button>
      ),
    },
  ];

  return (
    <section aria-labelledby="areas-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="areas-heading" className="text-title font-black tracking-normal">
          {t("heading", { count: areas.length })}
        </h2>
        <Button size="console" icon={<Plus aria-hidden="true" className="size-4" strokeWidth={2} />} onClick={() => edit(null)}>
          {t("add")}
        </Button>
      </div>

      {areas.length === 0 ? (
        <EmptyState title={t("emptyTitle")} lead={t("emptyLead")} />
      ) : (
        <DataTable caption={t("caption")} columns={columns} rows={areas} rowKey={(area) => area.id} />
      )}

      <AreaDialog key={editing.round} open={open} area={editing.area} onClose={() => setOpen(false)} onSaved={saved} />
    </section>
  );
}

function AreaDialog({
  open,
  area,
  onClose,
  onSaved,
}: {
  open: boolean;
  area: AreaOut | null;
  onClose: () => void;
  onSaved: (area: AreaOut, created: boolean) => void;
}) {
  const t = useTranslations("roster.areas");
  const formId = useId();
  const [draft, setDraft] = useState<AreaDraft>(() => areaDraft(area));
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const problems = useProblems(FIELDS, form);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    problems.clear();
    const patch = area ? areaPatchBody(area, draft) : null;
    if (patch && Object.keys(patch).length === 0) return onClose();
    setBusy(true);
    try {
      const saved =
        area && patch
          ? await apiPatch<AreaOut>(`/portal/areas/${area.id}`, patch)
          : await apiPost<AreaOut>("/portal/areas", areaCreateBody(draft));
      setBusy(false);
      onSaved(saved, area === null);
    } catch (err) {
      setBusy(false);
      problems.fail(err);
    }
  }

  return (
    <RecordDialog
      open={open}
      title={area ? t("editTitle", { name: area.name }) : t("addTitle")}
      formId={formId}
      saveLabel={area ? t("save") : t("addSubmit")}
      busy={busy}
      onClose={onClose}
    >
      <form id={formId} ref={form} onSubmit={(event) => void save(event)} className="flex flex-col gap-4">
        <Field
          label={t("name")}
          value={draft.name}
          onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          error={problems.fieldError("name")}
          autoComplete="off"
          maxLength={60}
          required
        />
        <TimeZoneField
          value={draft.tz}
          onChange={(tz) => setDraft((current) => ({ ...current, tz }))}
          error={problems.fieldError("tz")}
        />
        <FormProblems messages={problems.general} />
      </form>
    </RecordDialog>
  );
}
