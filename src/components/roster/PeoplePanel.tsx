"use client";

import type { Schemas } from "@crewstars/api-client";
import { UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { historyHref } from "@/components/audit/audit-query";
import {
  Avatar,
  Badge,
  Button,
  buttonClass,
  ConfirmDialog,
  DataTable,
  EmptyState,
  useToast,
  VisuallyHidden,
  type Column,
} from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";
import { describeFailure } from "@/lib/api-errors";

import { PersonDialog } from "./PersonDialog";
import { placementOf } from "./person-form";
import { RoleChip, useProblemText } from "./RosterBits";

type PersonOut = Schemas["PersonOut"];
type StoreOut = Schemas["StoreOut"];
type AreaOut = Schemas["AreaOut"];

/** The person whose form is open (null: someone new); `round` remounts it for each opening. */
type Editing = { person: PersonOut | null; round: number };
type Confirming = { person: PersonOut; action: "terminate" | "reactivate" };

/**
 * The People tab's table and everything done from it: add and edit in the side panel,
 * terminate and reactivate behind a confirmation, and a link to each person's history in the
 * audit log (NF-09). Each change is saved through the BFF and
 * the page is drawn again from the server (router.refresh), so the table, the counts and the
 * stores' GMs all show what the API now holds.
 *
 * The filters and the pager around it are the server page's: they are links and a GET form.
 */
export function PeoplePanel({
  people,
  total,
  stores,
  areas,
  filtered,
}: {
  people: readonly PersonOut[];
  total: number;
  stores: readonly StoreOut[];
  areas: readonly AreaOut[];
  /** Whether any filter is on, which decides what an empty table says. */
  filtered: boolean;
}) {
  const t = useTranslations("roster.people");
  const tc = useTranslations("common");
  const router = useRouter();
  const toast = useToast();
  const problemText = useProblemText();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>({ person: null, round: 0 });
  const [confirming, setConfirming] = useState<Confirming | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  function edit(person: PersonOut | null) {
    setEditing((was) => ({ person, round: was.round + 1 }));
    setOpen(true);
  }

  function saved(person: PersonOut, created: boolean) {
    setOpen(false);
    toast.show(created ? t("added", { name: person.name }) : t("saved", { name: person.name }));
    router.refresh();
  }

  async function confirm(): Promise<boolean> {
    if (!confirming) return false;
    const { person, action } = confirming;
    setConfirmError(null);
    try {
      await apiPost<PersonOut>(`/portal/people/${person.id}/${action}`);
    } catch (err) {
      const [problem] =
        err instanceof ApiCallError ? describeFailure(err) : [{ field: null, code: "generic", values: {} }];
      setConfirmError(problemText(problem!));
      return false;
    }
    toast.show(
      action === "terminate"
        ? t("terminated", { name: person.name })
        : t("reactivated", { name: person.name }),
    );
    router.refresh();
    return true;
  }

  const columns: Column<PersonOut>[] = [
    {
      key: "name",
      header: t("columns.name"),
      overflow: "wrap",
      cell: (person) => (
        <span className="flex items-center gap-2.5">
          <Avatar name={person.name} colored seed={person.id} className="size-8 text-caption" />
          <span className="font-extrabold">{person.name}</span>
        </span>
      ),
    },
    {
      key: "eid",
      header: t("columns.eid"),
      overflow: "nowrap",
      cell: (person) => <span className="font-mono">{person.eid ?? "—"}</span>,
    },
    { key: "role", header: t("columns.role"), cell: (person) => <RoleChip role={person.role} /> },
    {
      key: "where",
      header: t("columns.where"),
      overflow: "wrap",
      cell: (person) => <Where person={person} />,
    },
    {
      key: "setup",
      header: t("columns.setup"),
      hideBelow: "lg",
      cell: (person) =>
        person.setup_done ? <Badge tone="success">{t("setupDone")}</Badge> : <Badge>{t("setupNotYet")}</Badge>,
    },
    {
      key: "phone",
      header: t("columns.phone"),
      overflow: "nowrap",
      hideBelow: "xl",
      cell: (person) =>
        person.phone_masked ? (
          <span className="tabular-nums">{person.phone_masked}</span>
        ) : (
          <span className="text-muted">{t("noPhone")}</span>
        ),
    },
    {
      key: "status",
      header: t("columns.status"),
      cell: (person) => (
        <span className="flex flex-wrap gap-1.5">
          {person.status === "active" ? (
            <Badge tone="success">{t("active")}</Badge>
          ) : (
            <Badge tone="danger">{t("terminatedBadge")}</Badge>
          )}
          {person.locked ? <Badge tone="warning">{t("locked")}</Badge> : null}
        </span>
      ),
    },
    {
      key: "actions",
      header: t("columns.actions"),
      width: "min",
      pin: "end",
      cell: (person) => (
        // One line in the full table; in a stacked card they wrap if a phone is too narrow.
        <span className="flex flex-wrap gap-2">
          <Button variant="secondary" size="console" onClick={() => edit(person)}>
            {t("edit")}
            <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
          </Button>
          {person.status === "active" ? (
            <Button
              variant="danger"
              size="console"
              onClick={() => {
                setConfirmError(null);
                setConfirming({ person, action: "terminate" });
              }}
            >
              {t("terminate")}
              <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="console"
              onClick={() => {
                setConfirmError(null);
                setConfirming({ person, action: "reactivate" });
              }}
            >
              {t("reactivate")}
              <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
            </Button>
          )}
          {/* Everything done to them, from the audit log (NF-09). */}
          <Link href={historyHref(person.id)} className={buttonClass({ variant: "ghost", size: "console" })}>
            {t("history")}
            <VisuallyHidden>{` ${person.name}`}</VisuallyHidden>
          </Link>
        </span>
      ),
    },
  ];

  return (
    <section aria-labelledby="people-heading" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="people-heading" className="text-title font-black tracking-normal">
          {t("heading", { count: total })}
        </h2>
        <Button
          size="console"
          icon={<UserPlus aria-hidden="true" className="size-4" strokeWidth={2} />}
          onClick={() => edit(null)}
        >
          {t("add")}
        </Button>
      </div>

      {people.length === 0 && !filtered ? (
        <EmptyState
          title={t("emptyTitle")}
          lead={t("emptyLead")}
          action={
            <Link href="/roster?tab=import" className={buttonClass({ variant: "secondary", size: "console" })}>
              {t("importInstead")}
            </Link>
          }
        />
      ) : (
        <DataTable
          caption={t("caption")}
          columns={columns}
          rows={people}
          rowKey={(person) => person.id}
          empty={
            <p className="text-sm text-muted">
              {t("noMatch")}{" "}
              <Link href="/roster" className="font-extrabold text-brand-ink underline underline-offset-2">
                {t("clearFilters")}
              </Link>
            </p>
          }
        />
      )}

      <PersonDialog
        key={editing.round}
        open={open}
        person={editing.person}
        stores={stores}
        areas={areas}
        onClose={() => setOpen(false)}
        onSaved={saved}
      />

      {confirming ? (
        <ConfirmDialog
          title={
            confirming.action === "terminate"
              ? t("terminateTitle", { name: confirming.person.name })
              : t("reactivateTitle", { name: confirming.person.name })
          }
          confirmLabel={confirming.action === "terminate" ? t("terminate") : t("reactivate")}
          cancelLabel={tc("cancel")}
          tone={confirming.action === "terminate" ? "danger" : "primary"}
          error={confirmError}
          onConfirm={confirm}
          onClose={() => setConfirming(null)}
        >
          {confirming.action === "terminate" ? (
            <>
              <p>{t("terminateBody", { name: confirming.person.name })}</p>
              <p className="text-muted">{t("terminateKeep")}</p>
            </>
          ) : (
            <p>{t("reactivateBody", { name: confirming.person.name })}</p>
          )}
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

/** Where someone works, as their role puts them: a store, a supervisor's stores, or an area. */
function Where({ person }: { person: PersonOut }) {
  const t = useTranslations("roster.people");
  const kind = placementOf(person.role);
  if (kind === "store" && person.store) {
    return (
      <span>
        <span className="font-bold tabular-nums">{person.store.number}</span> · {person.store.name}
      </span>
    );
  }
  if (kind === "stores" && person.stores && person.stores.length > 0) {
    return (
      <span title={person.stores.map((store) => `${store.number} · ${store.name}`).join(", ")}>
        {t("stores", { list: person.stores.map((store) => store.number).join(", ") })}
      </span>
    );
  }
  if (kind === "area" && person.area) return <span>{person.area.name}</span>;
  return <span className="text-muted">{t("nowhere")}</span>;
}
