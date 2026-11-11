import {
  Award,
  Coins,
  FerrisWheel,
  Gift,
  Heart,
  LayoutGrid,
  ListChecks,
  ScrollText,
  Store,
  Trophy,
  Users,
  type LucideIcon,
} from "lucide-react";

/** Every page of the owner portal (plan §9). */
export type PortalKey =
  | "overview"
  | "recognize"
  | "people"
  | "redemptions"
  | "rewards"
  | "coins"
  | "spin"
  | "badges"
  | "awards"
  | "roster"
  | "audit";

export interface PortalLink {
  key: PortalKey;
  href: string;
  icon: LucideIcon;
  /** The roadmap phase that builds the page (plan §16). */
  phase: "P1" | "P2" | "P3" | "P4" | "P5";
  /** Current on its own path only: the overview lives at "/". */
  exact?: boolean;
}

export interface PortalGroup {
  key: "recognition" | "rules" | "admin";
  items: readonly PortalLink[];
}

/** The rail, in the prototype's order and groups. Owners see all of it: the portal is theirs
 *  alone (plan §1), so there is no per-role filtering here. */
export const PORTAL_NAV: readonly PortalGroup[] = [
  {
    key: "recognition",
    items: [
      { key: "overview", href: "/", icon: LayoutGrid, phase: "P2", exact: true },
      { key: "recognize", href: "/recognize", icon: Heart, phase: "P2" },
      { key: "people", href: "/people", icon: Store, phase: "P2" },
      { key: "redemptions", href: "/redemptions", icon: ListChecks, phase: "P3" },
    ],
  },
  {
    key: "rules",
    items: [
      { key: "rewards", href: "/rewards", icon: Gift, phase: "P3" },
      { key: "coins", href: "/coins", icon: Coins, phase: "P3" },
      { key: "spin", href: "/spin", icon: FerrisWheel, phase: "P4" },
      { key: "badges", href: "/badges", icon: Award, phase: "P4" },
      { key: "awards", href: "/awards", icon: Trophy, phase: "P4" },
    ],
  },
  {
    key: "admin",
    items: [
      { key: "roster", href: "/roster", icon: Users, phase: "P1" },
      { key: "audit", href: "/audit", icon: ScrollText, phase: "P5" },
    ],
  },
];

export function portalLink(key: PortalKey): PortalLink {
  for (const group of PORTAL_NAV) {
    const found = group.items.find((item) => item.key === key);
    if (found) return found;
  }
  throw new Error(`no portal page ${key}`);
}
