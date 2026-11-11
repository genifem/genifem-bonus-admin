import type { Schemas } from "@crewstars/api-client";

import type { Role } from "./roster-query";

/**
 * The Add / Edit person form, as plain data, and the request bodies it turns into. Pure, so
 * the rules about what is sent can be tested without a browser.
 *
 * Where someone works follows their role (the API's resolve_placement): crew, shift managers
 * and GMs work at one store, a supervisor covers several, a director runs an area.
 */

type PersonOut = Schemas["PersonOut"];
type Language = Schemas["PersonIn"]["language"];

export type Placement = "store" | "stores" | "area";

export function placementOf(role: Role): Placement {
  if (role === "supervisor") return "stores";
  if (role === "director") return "area";
  return "store";
}

/** The API field each placement is checked under (`details.field` on a 422). */
export const PLACEMENT_FIELD: Record<Placement, "store_id" | "store_ids" | "area_id"> = {
  store: "store_id",
  stores: "store_ids",
  area: "area_id",
};

export interface PersonDraft {
  eid: string;
  name: string;
  role: Role;
  storeId: string;
  storeIds: string[];
  areaId: string;
  /** A new number; blank leaves the one on file (or none, for someone new). */
  phone: string;
  /** Takes the number on file off (`phone: null`). */
  removePhone: boolean;
  /** YYYY-MM-DD, as a date input gives it; blank for none. */
  hireDate: string;
  language: Language;
}

/** The form for someone new, or filled in from the roster for an edit. The phone is never
 *  filled in: the portal only ever sees it masked. */
export function draftFrom(person?: PersonOut | null): PersonDraft {
  return {
    eid: person?.eid ?? "",
    name: person?.name ?? "",
    role: person?.role ?? "crew",
    storeId: person?.store?.id ?? "",
    storeIds: person?.stores?.map((store) => store.id) ?? [],
    areaId: person?.area?.id ?? "",
    phone: "",
    removePhone: false,
    hireDate: person?.hire_date ?? "",
    language: person?.language ?? "en",
  };
}

const oneLine = (text: string) => text.trim().replace(/\s+/g, " ");
/** How the API stores an Employee ID: no spaces, upper case. */
const asEid = (text: string) => text.replace(/\s+/g, "").toUpperCase();

/** Where someone in `draft.role` works, as the API takes it. A supervisor's area is left to
 *  the API to work out from their stores (sent as null, so a move re-works it out). */
function placementBody(draft: PersonDraft): Pick<Schemas["PersonPatch"], "store_id" | "store_ids" | "area_id"> {
  switch (placementOf(draft.role)) {
    case "store":
      return { store_id: draft.storeId || null };
    case "stores":
      return { store_ids: [...new Set(draft.storeIds)], area_id: null };
    case "area":
      return { area_id: draft.areaId || null };
  }
}

export function createBody(draft: PersonDraft): Schemas["PersonIn"] {
  const body: Schemas["PersonIn"] = {
    eid: draft.eid.trim(),
    name: oneLine(draft.name),
    role: draft.role,
    language: draft.language,
  };
  const placement = placementBody(draft);
  if (placement.store_id) body.store_id = placement.store_id;
  if (placement.store_ids) body.store_ids = placement.store_ids;
  if (placement.area_id) body.area_id = placement.area_id;
  if (draft.phone.trim()) body.phone = draft.phone.trim();
  if (draft.hireDate) body.hire_date = draft.hireDate;
  return body;
}

const sameSet = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && new Set([...a, ...b]).size === new Set(a).size;

/**
 * Only what changed (PersonPatch changes just the fields it is sent). A change of role or of
 * where they work sends the role with the placement that goes with it; nothing changed is an
 * empty object, which the form treats as done.
 */
export function patchBody(person: PersonOut, draft: PersonDraft): Schemas["PersonPatch"] {
  const before = draftFrom(person);
  const patch: Schemas["PersonPatch"] = {};
  if (asEid(draft.eid) !== asEid(before.eid)) patch.eid = draft.eid.trim();
  if (oneLine(draft.name) !== oneLine(before.name)) patch.name = oneLine(draft.name);
  if (draft.removePhone) patch.phone = null;
  else if (draft.phone.trim()) patch.phone = draft.phone.trim();
  if (draft.hireDate !== before.hireDate) patch.hire_date = draft.hireDate || null;
  if (draft.language !== before.language) patch.language = draft.language;

  const kind = placementOf(draft.role);
  const moved =
    draft.role !== before.role ||
    (kind === "store" && draft.storeId !== before.storeId) ||
    (kind === "stores" && !sameSet(draft.storeIds, before.storeIds)) ||
    (kind === "area" && draft.areaId !== before.areaId);
  if (moved) Object.assign(patch, { role: draft.role }, placementBody(draft));
  return patch;
}
