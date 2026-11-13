import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { Popover } from "@/components/console/Popover";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar, Sidebar, type NavGroup } from "@/components/ui";
import { can, type PlatformAdmin } from "@/lib/platform";
import { RAIL_COOKIE, railState } from "@/lib/rail";

import { IdleSignOut } from "./IdleSignOut";
import { BACK_OFFICE_NAV } from "./nav";

/**
 * The frame around every back office page (admin.<base>, P7): the owner portal's own layout -
 * the same collapsible rail (Sidebar), page column and density - with the back office's
 * destinations, and the signed-in admin with their role and the way out at its foot.
 *
 * Rows the admin's role cannot read are not drawn (nav.ts): support sees no Staff. The lockup
 * says "Back office" where the portal's says "Owner portal", so nobody mistakes the surface
 * that can see every operator for one operator's portal.
 *
 * Whether the rail is open or folded is the same cookie as the portal's (lib/rail.ts), kept
 * per host like every cookie here.
 */
export async function BackOfficeShell({ admin, children }: { admin: PlatformAdmin; children: React.ReactNode }) {
  const [t, tBrand, jar] = await Promise.all([
    getTranslations("platform.shell"),
    getTranslations("brand"),
    cookies(),
  ]);

  const groups: NavGroup[] = BACK_OFFICE_NAV.map((group) => ({
    title: group.key ? t(`nav.groups.${group.key}`) : undefined,
    items: group.items
      .filter((link) => can(admin, link.needs))
      .map((link) => ({ key: link.key, label: t(`nav.${link.key}`), href: link.href, icon: link.icon, exact: link.exact })),
  })).filter((group) => group.items.length > 0);

  const role = t(`roles.${admin.role}`);
  const card = (id: string) => <AccountCard id={id} admin={admin} role={role} signedInAs={t("signedInAs")} />;
  const accountName = t("accountOf", { name: admin.name });

  return (
    <Sidebar
      brand={<Lockup name={tBrand("name")} subtitle={t("subtitle")} />}
      groups={groups}
      label={t("nav.label")}
      rail={railState(jar.get(RAIL_COOKIE)?.value)}
      toggleLabels={{ collapse: t("rail.collapse"), expand: t("rail.expand") }}
      account={card("account-title")}
      foldedAccount={
        <span data-rail-tip={accountName} className="inline-flex">
          <Popover
            label={accountName}
            placement="up-start"
            icon={<Avatar name={admin.name} colored seed={admin.email} className="size-8.5 text-caption" />}
            triggerClassName="flex size-11 items-center justify-center rounded-full transition-colors duration-fast hover:bg-sidebar-hover-bg"
            panelClassName="w-64 border border-sidebar-border bg-sidebar-bg text-sidebar-fg"
          >
            {card("account-title-folded")}
          </Popover>
        </span>
      }
      compactAccount={
        <>
          <LanguageSwitcher />
          <SignOutButton compact backOffice />
        </>
      }
    >
      <IdleSignOut />
      {children}
    </Sidebar>
  );
}

/** "Signed in as", who and their role, and the language and the way out under it. */
function AccountCard({
  id,
  admin,
  role,
  signedInAs,
}: {
  /** The heading's id: the card is drawn twice, open rail and folded rail's menu. */
  id: string;
  admin: PlatformAdmin;
  role: string;
  signedInAs: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="eyebrow px-3 pt-3">
        {signedInAs}
      </h2>
      <div className="flex items-center gap-2.5 px-3">
        <Avatar name={admin.name} colored seed={admin.email} className="size-8.5 text-caption" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold" title={admin.email}>
            {admin.name}
          </span>
          <span className="block truncate text-xs text-muted">{role}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 px-3 pt-1">
        <LanguageSwitcher />
        <SignOutButton size="sm" backOffice className="grow" />
      </div>
    </section>
  );
}
