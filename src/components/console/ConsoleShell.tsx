import { getTranslations } from "next-intl/server";

import { Lockup } from "@/components/Brand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SignOutButton } from "@/components/SignOutButton";
import { Avatar, Sidebar, type NavGroup } from "@/components/ui";
import { loadOwner, type Owner } from "@/lib/me";

import { PORTAL_NAV } from "./nav";

/**
 * The frame around every owner-portal page (plan §9, the prototype's `.o-app`): the white rail
 * with the grouped destinations, and the signed-in owner with the way out at its foot (OP-21).
 *
 * The owner's name comes from GET /api/v1/me. The chrome decides nothing with it, so when the
 * call fails the rail is drawn without a name rather than not at
 * all; src/proxy.ts and the API are what keep a signed-out browser out.
 */
export async function ConsoleShell({ children }: { children: React.ReactNode }) {
  const [owner, t, tBrand] = await Promise.all([
    loadOwner(),
    getTranslations("portal"),
    getTranslations("brand"),
  ]);

  const groups: NavGroup[] = PORTAL_NAV.map((group) => ({
    title: t(`nav.groups.${group.key}`),
    items: group.items.map((link) => ({
      key: link.key,
      label: t(`nav.${link.key}`),
      href: link.href,
      icon: link.icon,
      exact: link.exact,
    })),
  }));

  return (
    <Sidebar
      brand={<Lockup name={tBrand("name")} subtitle={tBrand("portal")} />}
      groups={groups}
      label={t("nav.label")}
      account={<AccountCard owner={owner} signedInAs={t("signedInAs")} role={t("owner")} />}
      compactAccount={
        <>
          <LanguageSwitcher />
          <SignOutButton size="sm" />
        </>
      }
    >
      {children}
    </Sidebar>
  );
}

/** "Signed in as", who, and the language and the way out under it. */
function AccountCard({
  owner,
  signedInAs,
  role,
}: {
  owner: Owner | null;
  signedInAs: string;
  role: string;
}) {
  return (
    <section aria-labelledby="account-title" className="flex flex-col gap-2">
      <h2 id="account-title" className="eyebrow px-3 pt-3">
        {signedInAs}
      </h2>
      <div className="flex items-center gap-2.5 px-3">
        {owner ? <Avatar name={owner.name} colored seed={owner.name} className="size-8.5 text-caption" /> : null}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-extrabold">{owner?.name ?? role}</span>
          {owner ? <span className="block truncate text-xs text-muted">{role}</span> : null}
        </span>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1">
        <LanguageSwitcher />
        <SignOutButton size="sm" className="flex-1" />
      </div>
    </section>
  );
}
