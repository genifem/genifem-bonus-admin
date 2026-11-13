/**
 * An operator's address (P7). Its slug is the first label of its portal's host,
 * `{slug}.stars.genifem.com`, and the company code people type in the mobile app.
 *
 * The rules are the API's (bonus-backend app/modules/org/models.py SLUG_RE and
 * RESERVED_SLUGS), repeated here so the New operator form can say what is wrong before
 * anything is sent and so the host routing (lib/host.ts) never treats one of our own hosts as
 * an operator. The API checks again on create. Pure, and safe in the browser.
 */

export const SLUG_MAX = 32;

/** Lowercase letters, digits and dashes, 1-32 characters, a letter or digit at each end. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

/** Hosts that are ours, so no operator can take them (`admin` is the back office). */
export const RESERVED_SLUGS: readonly string[] = [
  "admin",
  "api",
  "www",
  "app",
  "static",
  "assets",
  "mail",
  "status",
  "help",
  "docs",
  "cdn",
  "login",
  "platform",
];

export type SlugProblem = "empty" | "tooLong" | "characters" | "edges" | "reserved";

/** What is wrong with a slug, in the order a person would fix it, or null when it is fine. */
export function slugProblem(slug: string): SlugProblem | null {
  if (slug === "") return "empty";
  if (slug.length > SLUG_MAX) return "tooLong";
  if (!/^[a-z0-9-]+$/.test(slug)) return "characters";
  if (!SLUG_RE.test(slug)) return "edges";
  if (RESERVED_SLUGS.includes(slug)) return "reserved";
  return null;
}

/** A slug suggested from a company name, until someone types their own:
 *  "Acme Burgers, Inc." -> "acme-burgers-inc", "Café Olé" -> "cafe-ole". */
export function suggestSlug(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/, "");
}
