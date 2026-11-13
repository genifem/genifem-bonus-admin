import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar, Sidebar, type NavGroup } from "@/components/ui";
import { loadOwner, type Owner } from "@/lib/me";
import { RAIL_COOKIE, railState } from "@/lib/rail";
import { isScopedPath } from "@/lib/store-scope";

import { PORTAL_NAV } from "./nav";
import { Popover } from "./Popover";

/**
 * The frame around every owner-portal page (plan §9, the prototype's `.o-app`): the white rail
 * with the grouped destinations, and the signed-in owner with the way out at its foot (OP-21).
 *
 * The owner's name comes from GET /api/v1/me. The chrome decides nothing with it, so when the
 * call fails the rail is drawn without a name rather than not at
 * all; src/proxy.ts and the API are what keep a signed-out browser out.
 *
 * Whether the rail is open or folded to its icons is read here from its cookie (lib/rail.ts),
 * so the server draws it the way the owner left it.
 */
export async function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [owner, t, tBrand, jar] = await Promise.all([
    loadOwner(),
    getTranslations("portal"),
    getTranslations("brand"),
    cookies(),
  ]);

  const groups: NavGroup[] = PORTAL_NAV.map((group) => ({
    title: t(`nav.groups.${group.key}`),
    items: group.items.map((link) => ({
      key: link.key,
      label: t(`nav.${link.key}`),
      href: link.href,
      icon: link.icon,
      exact: link.exact,
      // The pages the store filter belongs to carry it from one to the next (OP-01).
      scoped: isScopedPath(link.href),
    })),
  }));

  const card = (id: string) => (
    <AccountCard id={id} owner={owner} signedInAs={t("signedInAs")} role={t("owner")} />
  );
  // The folded rail's account button: its name, and its tooltip, say whose account it is.
  const accountName = owner ? t("accountOf", { name: owner.name }) : t("account");

  return (
    <Sidebar
      brand={<Lockup name={tBrand("name")} subtitle={tBrand("portal")} />}
      groups={groups}
      label={t("nav.label")}
      rail={railState(jar.get(RAIL_COOKIE)?.value)}
      toggleLabels={{ collapse: t("rail.collapse"), expand: t("rail.expand") }}
      account={card("account-title")}
      foldedAccount={
        // The same card, a tap away: the avatar alone in a folded rail.
        <span data-rail-tip={accountName} className="inline-flex">
          <Popover
            label={accountName}
            placement="up-start"
            icon={
              owner ? (
                <Avatar name={owner.name} colored seed={owner.name} className="size-8.5 text-caption" />
              ) : (
                <Avatar name={t("owner")} className="size-8.5 text-caption" />
              )
            }
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
          <SignOutButton compact />
        </>
      }
    >
      {children}
    </Sidebar>
  );
}

/** "Signed in as", who, and the language and the way out under it. */
function AccountCard({
  id,
  owner,
  signedInAs,
  role,
}: {
  /** The heading's id: the card is drawn twice, open rail and folded rail's menu. */
  id: string;
  owner: Owner | null;
  signedInAs: string;
  role: string;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="eyebrow px-3 pt-3">
        {signedInAs}
      </h2>
      <div className="flex items-center gap-2.5 px-3">
        {owner ? <Avatar name={owner.name} colored seed={owner.name} className="size-8.5 text-caption" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold" title={owner?.name}>
            {owner?.name ?? role}
          </span>
          {owner ? <span className="block truncate text-xs text-muted">{role}</span> : null}
        </span>
      </div>
      {/* Sign out sits beside the languages when its words fit, and under them, full width,
          when they do not ("Cerrar sesión" in a 240px rail). */}
      <div className="flex flex-wrap items-center gap-2 px-3 pt-1">
        <LanguageSwitcher />
        <SignOutButton size="sm" className="grow" />
      </div>
    </section>
  );
}
