import type { Schemas } from "@crewstars/api-client";
import { Lock } from "lucide-react";
import type { useFormatter } from "next-intl";

import { Badge, cx, type BadgeTone } from "@/components/ui";

/**
 * Small pieces the back office's pages share: how a time is written, the status chips, and
 * the panel that stands in for something the admin's role may not read.
 */

type Format = Pick<ReturnType<typeof useFormatter>, "dateTime" | "relativeTime">;

/** "Nov 13, 2026, 5:04 PM UTC": the back office is not in any operator's time zone, so its
 *  times say which they are in. */
export function when(format: Format, iso: string | null | undefined): string | null {
  if (!iso) return null;
  const moment = format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });
  return `${moment} UTC`;
}

/** "3 hours ago", with `when` beside it for the exact moment. */
export function ago(format: Format, iso: string | null | undefined, now: Date): string | null {
  if (!iso) return null;
  return format.relativeTime(new Date(iso), now);
}

/** A time as "3 hours ago", with the exact moment on hover and for a screen reader. */
export function Ago({ format, iso, now, never }: { format: Format; iso: string | null | undefined; now: Date; never: string }) {
  if (!iso) return <span className="text-muted">{never}</span>;
  return (
    <time dateTime={iso} title={when(format, iso) ?? undefined}>
      {ago(format, iso, now)}
    </time>
  );
}

export type OperatorStatus = Schemas["OperatorRowOut"]["status"];

export const OPERATOR_TONE: Record<OperatorStatus, BadgeTone> = { active: "success", suspended: "warning" };

/** Where an owner or a colleague stands, most pressing first: switched off, locked out, an
 *  invite that ran out or is waiting, or signed in. */
export type AccountState = "suspended" | "locked" | "inviteExpired" | "invited" | "active";

export const ACCOUNT_TONE: Record<AccountState, BadgeTone> = {
  suspended: "neutral",
  locked: "danger",
  inviteExpired: "warning",
  invited: "brand",
  active: "success",
};

export function ownerState(owner: Schemas["PlatformOwnerOut"]): AccountState {
  if (owner.status === "disabled") return "suspended";
  if (owner.locked) return "locked";
  if (owner.invited) return owner.invite_expired ? "inviteExpired" : "invited";
  return "active";
}

export function staffState(staff: Schemas["StaffOut"]): AccountState {
  if (!staff.active) return "suspended";
  if (staff.locked) return "locked";
  if (staff.invited) return staff.invite_expired ? "inviteExpired" : "invited";
  return "active";
}

export function StateBadge({ state, label }: { state: AccountState; label: string }) {
  return <Badge tone={ACCOUNT_TONE[state]}>{label}</Badge>;
}

/**
 * In place of a panel the signed-in role may not read (the API would answer 403
 * platform_permission_missing). Says so plainly, and names the permission, rather than showing
 * an empty table that looks like "nothing here".
 */
export function NoAccess({
  title,
  lead,
  permission,
  className,
}: {
  title: string;
  lead: string;
  permission: string;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface px-6 py-10 text-center",
        className,
      )}
    >
      <span aria-hidden="true" className="flex size-10 items-center justify-center rounded-lg bg-surface-raised text-muted">
        <Lock className="size-5" strokeWidth={2} />
      </span>
      <p className="font-extrabold">{title}</p>
      <p className="max-w-sm text-sm text-muted">{lead}</p>
      <code className="mt-1 rounded-sm bg-surface-raised px-2 py-0.5 font-mono text-xs text-muted">{permission}</code>
    </div>
  );
}
