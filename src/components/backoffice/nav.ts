import { Activity, Building2, LayoutGrid, ScrollText, UserCog, type LucideIcon } from "lucide-react";

import type { PlatformPermission } from "@/lib/platform";

/** Every page of the back office (P7). */
export type BackOfficeKey = "overview" | "operators" | "health" | "audit" | "staff";

export interface BackOfficeLink {
  key: BackOfficeKey;
  href: string;
  icon: LucideIcon;
  /** The permission that shows the row: a page the role cannot read is not offered at all.
   *  The page still checks for itself, and the API checks every call. */
  needs: PlatformPermission;
  /** Current on its own path only: the overview lives at "/". */
  exact?: boolean;
}

export interface BackOfficeGroup {
  /** The label above the group; the first group has none. */
  key?: "operations" | "team";
  items: readonly BackOfficeLink[];
}

/** The back office's rail. Staff is super_admin's alone (staff.read). */
export const BACK_OFFICE_NAV: readonly BackOfficeGroup[] = [
  {
    items: [
      { key: "overview", href: "/", icon: LayoutGrid, needs: "overview.read", exact: true },
      { key: "operators", href: "/operators", icon: Building2, needs: "operators.read" },
    ],
  },
  {
    key: "operations",
    items: [
      { key: "health", href: "/health", icon: Activity, needs: "health.read" },
      { key: "audit", href: "/audit", icon: ScrollText, needs: "audit.read" },
    ],
  },
  {
    key: "team",
    items: [{ key: "staff", href: "/staff", icon: UserCog, needs: "staff.read" }],
  },
];
