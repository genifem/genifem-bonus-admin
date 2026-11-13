"use client";

import type { Schemas } from "@crewstars/api-client";
import { Pencil, RotateCcw, Send, ShieldOff, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useMemo } from "react";

import { Field, SelectField } from "@/components/ui";
import { apiPatch, apiPost, ApiCallError } from "@/lib/api";

import { NAME_MAX, timeZoneChoices } from "./operator-form";
import { ownerActions, type OwnerPermissions } from "./owner-actions";
import { ReasonAction, type ActionOutcome } from "./ReasonDialog";

type OperatorDetail = Schemas["OperatorDetailOut"];
type Owner = Schemas["PlatformOwnerOut"];
type OwnerInvited = Schemas["OwnerInvitedOut"];

const icon = (Glyph: typeof Pencil) => <Glyph aria-hidden="true" className="size-4" strokeWidth={2.2} />;

/**
 * The writes on an operator's page (P7), each through the reason prompt (ReasonAction) and
 * each followed by the page drawn again from the server: edit the operator, suspend or
 * reactivate it, add an owner, and each owner's own actions. Only what the admin's role may do
 * is offered (the page decides from `permissions`); the API checks every call.
 */

/** Name, time zone and logo (PATCH /platform/operators/{id}): only what changed is sent. */
export function EditOperator({ operator }: { operator: OperatorDetail }) {
  const t = useTranslations("platform.operator.edit");
  const locale = useLocale();
  const zones = useMemo(() => timeZoneChoices(locale, operator.tz), [locale, operator.tz]);
  return (
    <ReasonAction
      label={t("button")}
      icon={icon(Pencil)}
      title={t("title")}
      subtitle={operator.name}
      confirmLabel={t("save")}
      done={t("done")}
      onConfirm={async (reason, data) => {
        const name = String(data.get("name") ?? "").trim();
        const tz = String(data.get("tz") ?? "");
        const logo = String(data.get("logo_url") ?? "").trim();
        const patch: Record<string, string | null> = {};
        if (name && name !== operator.name) patch.name = name;
        if (tz && tz !== operator.tz) patch.tz = tz;
        if ((logo || null) !== (operator.logo_url ?? null)) patch.logo_url = logo || null;
        // Nothing to save: said in the dialog, which stays open.
        if (Object.keys(patch).length === 0) throw new ApiCallError(0, "nothing_to_change", "nothing to change");
        await apiPatch(`/platform/operators/${operator.id}`, { ...patch, reason });
      }}
    >
      <Field label={t("name")} name="name" defaultValue={operator.name} maxLength={NAME_MAX} required />
      <SelectField label={t("tz")} name="tz" defaultValue={operator.tz} hint={t("tzHint")}>
        {zones.map((zone) => (
          <option key={zone.value} value={zone.value}>
            {zone.label}
          </option>
        ))}
      </SelectField>
      <Field
        label={t("logo")}
        name="logo_url"
        type="url"
        inputMode="url"
        defaultValue={operator.logo_url ?? ""}
        placeholder="https://"
        pattern="https://.*"
        maxLength={2083}
        hint={t("logoHint")}
      />
    </ReasonAction>
  );
}

/** Suspend (everyone at the operator is stopped, app and portal, until it is reactivated;
 *  nothing is deleted) or reactivate. */
export function OperatorStatusAction({ operator }: { operator: OperatorDetail }) {
  const t = useTranslations("platform.operator.danger");
  if (operator.status === "active") {
    return (
      <ReasonAction
        label={t("suspend.button")}
        variant="danger"
        icon={icon(ShieldOff)}
        tone="danger"
        title={t("suspend.title")}
        subtitle={operator.name}
        confirmLabel={t("suspend.confirm")}
        notice={<p className="text-sm">{t("suspend.explain")}</p>}
        done={t("suspend.done", { name: operator.name })}
        onConfirm={async (reason) => {
          await apiPost(`/platform/operators/${operator.id}/suspend`, { reason });
        }}
      />
    );
  }
  return (
    <ReasonAction
      label={t("reactivate.button")}
      variant="primary"
      icon={icon(RotateCcw)}
      title={t("reactivate.title")}
      subtitle={operator.name}
      confirmLabel={t("reactivate.confirm")}
      notice={<p className="text-sm">{t("reactivate.explain")}</p>}
      done={t("reactivate.done", { name: operator.name })}
      onConfirm={async (reason) => {
        await apiPost(`/platform/operators/${operator.id}/reactivate`, { reason });
      }}
    />
  );
}

/** What an invite email's sending came to, for the toast. */
function inviteOutcome(
  result: OwnerInvited,
  words: { sent: string; failed: string },
): ActionOutcome {
  return result.invite_email === "sent" ? words.sent : { message: words.failed, tone: "danger" };
}

/** Another owner for the operator (POST /platform/operators/{id}/owners), emailed an invite. */
export function AddOwner({ operator }: { operator: OperatorDetail }) {
  const t = useTranslations("platform.operator.owners");
  const tLang = useTranslations("common.languages");
  const locale = useLocale();
  return (
    <ReasonAction
      label={t("add")}
      size="xs"
      icon={icon(UserPlus)}
      title={t("addTitle")}
      subtitle={operator.name}
      confirmLabel={t("addConfirm")}
      notice={<p className="text-sm text-muted">{t("addNotice")}</p>}
      onConfirm={async (reason, data) => {
        const email = String(data.get("email") ?? "").trim();
        const result = await apiPost<OwnerInvited>(`/platform/operators/${operator.id}/owners`, {
          name: String(data.get("name") ?? "").trim(),
          email,
          language: data.get("language") === "es" ? "es" : "en",
          reason,
        });
        return inviteOutcome(result, { sent: t("inviteSent", { email }), failed: t("addedNotSent", { email }) });
      }}
    >
      <Field label={t("name")} name="name" maxLength={NAME_MAX} autoComplete="off" required />
      <Field label={t("email")} name="email" type="email" inputMode="email" maxLength={254} autoComplete="off" required />
      <SelectField label={t("language")} name="language" defaultValue={locale === "es" ? "es" : "en"} hint={t("languageHint")}>
        <option value="en">{tLang("en")}</option>
        <option value="es">{tLang("es")}</option>
      </SelectField>
    </ReasonAction>
  );
}

/** Send an owner's invite again: a new link, the old one stops working. */
export function ResendInvite({
  operatorId,
  owner,
  variant = "secondary",
}: {
  operatorId: string;
  owner: Owner;
  variant?: "secondary" | "primary";
}) {
  const t = useTranslations("platform.operator.owners");
  return (
    <ReasonAction
      label={t("resend")}
      ariaLabel={t("resendFor", { name: owner.name })}
      size="xs"
      variant={variant}
      icon={icon(Send)}
      title={t("resendTitle")}
      subtitle={`${owner.name} · ${owner.email}`}
      confirmLabel={t("resend")}
      notice={<p className="text-sm text-muted">{t("resendNotice")}</p>}
      onConfirm={async (reason) => {
        const result = await apiPost<OwnerInvited>(
          `/platform/operators/${operatorId}/owners/${owner.id}/resend-invite`,
          { reason },
        );
        return inviteOutcome(result, {
          sent: t("inviteSent", { email: owner.email }),
          failed: t("inviteFailed", { email: owner.email }),
        });
      }}
    />
  );
}

/** One owner's actions: send the invite again, turn their authenticator off (a lost phone),
 *  suspend or reactivate them - each only when it applies and the role may (owner-actions.ts). */
export function OwnerActions({
  operatorId,
  owner,
  permissions,
}: {
  operatorId: string;
  owner: Owner;
  permissions: OwnerPermissions;
}) {
  const t = useTranslations("platform.operator.owners");
  const base = `/platform/operators/${operatorId}/owners/${owner.id}`;
  const subtitle = `${owner.name} · ${owner.email}`;
  const actions = ownerActions(owner, permissions).map((action) => {
    switch (action) {
      case "resend":
        return <ResendInvite key="resend" operatorId={operatorId} owner={owner} />;
      case "mfaReset":
        return (
          <ReasonAction
            key="mfa"
            label={t("resetMfa")}
            ariaLabel={t("resetMfaFor", { name: owner.name })}
            size="xs"
            title={t("resetMfaTitle")}
            subtitle={subtitle}
            confirmLabel={t("resetMfa")}
            notice={<p className="text-sm">{t("resetMfaNotice")}</p>}
            done={t("resetMfaDone", { name: owner.name })}
            onConfirm={async (reason) => {
              await apiPost(`${base}/reset-mfa`, { reason });
            }}
          />
        );
      case "suspend":
        return (
          <ReasonAction
            key="suspend"
            label={t("suspend")}
            ariaLabel={t("suspendFor", { name: owner.name })}
            size="xs"
            variant="danger"
            tone="danger"
            title={t("suspendTitle")}
            subtitle={subtitle}
            confirmLabel={t("suspend")}
            notice={<p className="text-sm">{t("suspendNotice")}</p>}
            done={t("suspendDone", { name: owner.name })}
            onConfirm={async (reason) => {
              await apiPost(`${base}/suspend`, { reason });
            }}
          />
        );
      case "reactivate":
        return (
          <ReasonAction
            key="reactivate"
            label={t("reactivate")}
            ariaLabel={t("reactivateFor", { name: owner.name })}
            size="xs"
            title={t("reactivateTitle")}
            subtitle={subtitle}
            confirmLabel={t("reactivate")}
            done={t("reactivateDone", { name: owner.name })}
            onConfirm={async (reason) => {
              await apiPost(`${base}/reactivate`, { reason });
            }}
          />
        );
    }
  });
  if (actions.length === 0) return <span className="text-caption text-muted">{t("noActions")}</span>;
  return <div className="flex flex-wrap gap-2 spread:flex-nowrap spread:justify-end">{actions}</div>;
}
