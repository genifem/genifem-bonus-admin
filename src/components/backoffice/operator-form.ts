import { slugProblem, type SlugProblem } from "@/lib/slug";

/**
 * The New operator form's rules (P7), as pure functions so they can be tested on their own:
 * what each field must hold, the body POST /platform/operators takes, and where the API's
 * refusals belong. The API checks everything again.
 */

export type Language = "en" | "es";

export interface OperatorDraft {
  name: string;
  slug: string;
  tz: string;
  ownerName: string;
  ownerEmail: string;
  ownerLanguage: Language;
}

export type DraftField = keyof OperatorDraft;

export type DraftProblem =
  | { field: "name" | "ownerName"; problem: "required" | "tooLong" }
  | { field: "slug"; problem: SlugProblem | "taken" }
  | { field: "ownerEmail"; problem: "required" | "invalid" }
  | { field: "tz"; problem: "invalid" };

/** The API's limit on a name (an operator's or a person's). */
export const NAME_MAX = 100;

/** An address that looks like one: something@something.something, no spaces. The API's own
 *  check is stricter; this only catches a slip before sending. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function checkOperator(draft: OperatorDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const name = draft.name.trim();
  if (!name) problems.push({ field: "name", problem: "required" });
  else if (name.length > NAME_MAX) problems.push({ field: "name", problem: "tooLong" });
  const slug = slugProblem(draft.slug);
  if (slug) problems.push({ field: "slug", problem: slug });
  if (!draft.tz) problems.push({ field: "tz", problem: "invalid" });
  const owner = draft.ownerName.trim();
  if (!owner) problems.push({ field: "ownerName", problem: "required" });
  else if (owner.length > NAME_MAX) problems.push({ field: "ownerName", problem: "tooLong" });
  const email = draft.ownerEmail.trim();
  if (!email) problems.push({ field: "ownerEmail", problem: "required" });
  else if (!EMAIL_RE.test(email)) problems.push({ field: "ownerEmail", problem: "invalid" });
  return problems;
}

/** POST /platform/operators's body (OperatorCreateIn), with the reason. */
export function operatorBody(draft: OperatorDraft, reason: string) {
  return {
    name: draft.name.trim(),
    slug: draft.slug,
    tz: draft.tz,
    owner: { name: draft.ownerName.trim(), email: draft.ownerEmail.trim(), language: draft.ownerLanguage },
    reason,
  };
}

/** The form field an API refusal is about: `slug_taken` and `slug_reserved` are the address;
 *  a `validation_failed` names its fields by path (`slug`, `owner.email`). Null when it is
 *  about none of them, for the dialog to say. */
export function fieldsOfRefusal(code: string, details: unknown): Partial<Record<DraftField, string>> | null {
  if (code === "slug_taken") return { slug: "taken" };
  if (code === "slug_reserved") return { slug: "reserved" };
  if (code !== "validation_failed") return null;
  const fields = (details as { fields?: unknown } | null)?.fields;
  if (typeof fields !== "object" || fields === null) return null;
  const out: Partial<Record<DraftField, string>> = {};
  for (const path of Object.keys(fields)) {
    const field = FIELD_OF_PATH[path.replace(/^body\./, "")];
    if (field) out[field] = "invalid";
  }
  return Object.keys(out).length ? out : null;
}

const FIELD_OF_PATH: Record<string, DraftField> = {
  name: "name",
  slug: "slug",
  tz: "tz",
  "owner.name": "ownerName",
  "owner.email": "ownerEmail",
  "owner.language": "ownerLanguage",
};

/** The time zones an operator is most likely in (US restaurants), east to west, the API's
 *  default first. Another zone an operator already has is added by timeZoneChoices. */
export const TIME_ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Puerto_Rico",
] as const;

/** "Eastern Time (America/New_York)", in the page's language; the zone's id alone where the
 *  browser has no name for it. */
export function timeZoneLabel(zone: string, locale: string): string {
  try {
    const part = new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: "longGeneric" })
      .formatToParts(new Date(Date.UTC(2026, 0, 15)))
      .find((piece) => piece.type === "timeZoneName")?.value;
    return part ? `${part} (${zone})` : zone;
  } catch {
    return zone;
  }
}

/** The choices for a time zone select: the common ones, and `current` first when it is not
 *  one of them, so editing never drops what an operator has. */
export function timeZoneChoices(locale: string, current?: string): { value: string; label: string }[] {
  const zones: string[] = [...TIME_ZONES];
  if (current && !zones.includes(current)) zones.unshift(current);
  return zones.map((zone) => ({ value: zone, label: timeZoneLabel(zone, locale) }));
}
