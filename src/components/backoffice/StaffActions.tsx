"use client";

import type { Schemas } from "@crewstars/api-client";
import { Send, UserPlus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { Field, SelectField } from "@/components/ui";
import { apiPost } from "@/lib/api";

import { NAME_MAX } from "./operator-form";
import { ReasonAction, type ActionOutcome } from "./ReasonDialog";

type Staff = Schemas["StaffOut"];
type StaffInvited = Schemas["StaffInvitedOut"];

const ROLES = ["support", "super_admin"] as const;

function inviteOutcome(result: StaffInvited, words: { sent: string; failed: string }): ActionOutcome {
  return result.invite_email === "sent" ? words.sent : { message: words.failed, tone: "danger" };
}

/**
 * The back office's own team (P7, super admins only): invite a colleague - with a role, support
 * or super admin - and, for each, send the invite again, turn off a lost authenticator, suspend
 * or reactivate. Each asks for a reason. An admin's own row has no actions: the API asks for
 * another super admin to do those (403 staff_self).
 */
export function InviteStaff() {
  const t = useTranslations("platform.staff");
  const tLang = useTranslations("common.languages");
  const tRoles = useTranslations("platform.shell.roles");
  const locale = useLocale();
  return (
    <ReasonAction
      label={t("invite")}
      variant="primary"
      icon={<UserPlus aria-hidden="true" className="size-4.5" strokeWidth={2.2} />}
      title={t("inviteTitle")}
      confirmLabel={t("inviteConfirm")}
      notice={<p className="text-sm text-muted">{t("inviteNotice")}</p>}
      onConfirm={async (reason, data) => {
        const email = String(data.get("email") ?? "").trim();
        const result = await apiPost<StaffInvited>("/platform/staff", {
          name: String(data.get("name") ?? "").trim(),
          email,
          role: data.get("role") === "super_admin" ? "super_admin" : "support",
          language: data.get("language") === "es" ? "es" : "en",
          reason,
        });
        return inviteOutcome(result, { sent: t("inviteSent", { email }), failed: t("inviteFailed", { email }) });
      }}
    >
      <Field label={t("name")} name="name" maxLength={NAME_MAX} autoComplete="off" required />
      <Field label={t("email")} name="email" type="email" inputMode="email" maxLength={254} autoComplete="off" required />
      <SelectField label={t("role")} name="role" defaultValue="support" hint={t("roleHint")}>
        {ROLES.map((role) => (
          <option key={role} value={role}>
            {tRoles(role)}
          </option>
        ))}
      </SelectField>
      <SelectField label={t("language")} name="language" defaultValue={locale === "es" ? "es" : "en"}>
        <option value="en">{tLang("en")}</option>
        <option value="es">{tLang("es")}</option>
      </SelectField>
    </ReasonAction>
  );
}

export function StaffRowActions({ staff, canWrite }: { staff: Staff; canWrite: boolean }) {
  const t = useTranslations("platform.staff");
  if (!canWrite) return null;
  const base = `/platform/staff/${staff.id}`;
  const subtitle = `${staff.name} · ${staff.email}`;
  const actions: React.ReactNode[] = [];
  if (staff.invited && staff.active) {
    actions.push(
      <ReasonAction
        key="resend"
        label={t("resend")}
        ariaLabel={t("resendFor", { name: staff.name })}
        size="xs"
        icon={<Send aria-hidden="true" className="size-4" strokeWidth={2.2} />}
        title={t("resendTitle")}
        subtitle={subtitle}
        confirmLabel={t("resend")}
        notice={<p className="text-sm text-muted">{t("resendNotice")}</p>}
        onConfirm={async (reason) => {
          const result = await apiPost<StaffInvited>(`${base}/resend-invite`, { reason });
          return inviteOutcome(result, {
            sent: t("inviteSent", { email: staff.email }),
            failed: t("inviteFailed", { email: staff.email }),
          });
        }}
      />,
    );
  }
  if (staff.mfa_enabled) {
    actions.push(
      <ReasonAction
        key="mfa"
        label={t("resetMfa")}
        ariaLabel={t("resetMfaFor", { name: staff.name })}
        size="xs"
        title={t("resetMfaTitle")}
        subtitle={subtitle}
        confirmLabel={t("resetMfa")}
        notice={<p className="text-sm">{t("resetMfaNotice")}</p>}
        done={t("resetMfaDone", { name: staff.name })}
        onConfirm={async (reason) => {
          await apiPost(`${base}/reset-mfa`, { reason });
        }}
      />,
    );
  }
  actions.push(
    staff.active ? (
      <ReasonAction
        key="suspend"
        label={t("suspend")}
        ariaLabel={t("suspendFor", { name: staff.name })}
        size="xs"
        variant="danger"
        tone="danger"
        title={t("suspendTitle")}
        subtitle={subtitle}
        confirmLabel={t("suspend")}
        notice={<p className="text-sm">{t("suspendNotice")}</p>}
        done={t("suspendDone", { name: staff.name })}
        onConfirm={async (reason) => {
          await apiPost(`${base}/suspend`, { reason });
        }}
      />
    ) : (
      <ReasonAction
        key="reactivate"
        label={t("reactivate")}
        ariaLabel={t("reactivateFor", { name: staff.name })}
        size="xs"
        title={t("reactivateTitle")}
        subtitle={subtitle}
        confirmLabel={t("reactivate")}
        done={t("reactivateDone", { name: staff.name })}
        onConfirm={async (reason) => {
          await apiPost(`${base}/reactivate`, { reason });
        }}
      />
    ),
  );
  return <div className="flex flex-wrap gap-2 spread:flex-nowrap spread:justify-end">{actions}</div>;
}
