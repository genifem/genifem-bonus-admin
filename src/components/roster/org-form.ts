import type { Schemas } from "@crewstars/api-client";

/**
 * The store and area forms, as plain data, and the request bodies they turn into. Edits send
 * only what changed; a blank area or time zone is sent as null, which clears it (the operator's
 * default time zone then applies). Pure, so it can be tested without a browser.
 */

type StoreOut = Schemas["StoreOut"];
type AreaOut = Schemas["AreaOut"];

export interface StoreDraft {
  number: string;
  name: string;
  /** Blank for none. */
  areaId: string;
  /** An IANA zone, or blank for the operator's default. */
  tz: string;
  active: boolean;
}

export interface AreaDraft {
  name: string;
  tz: string;
}

const oneLine = (text: string) => text.trim().replace(/\s+/g, " ");

export function storeDraft(store?: StoreOut | null): StoreDraft {
  return {
    number: store?.number ?? "",
    name: store?.name ?? "",
    areaId: store?.area?.id ?? "",
    tz: store?.tz ?? "",
    active: store?.active ?? true,
  };
}

export function storeCreateBody(draft: StoreDraft): Schemas["StoreIn"] {
  const body: Schemas["StoreIn"] = { number: draft.number.trim(), name: oneLine(draft.name) };
  if (draft.areaId) body.area_id = draft.areaId;
  if (draft.tz) body.tz = draft.tz;
  return body;
}

export function storePatchBody(store: StoreOut, draft: StoreDraft): Schemas["StorePatch"] {
  const before = storeDraft(store);
  const patch: Schemas["StorePatch"] = {};
  if (draft.number.trim() !== before.number) patch.number = draft.number.trim();
  if (oneLine(draft.name) !== before.name) patch.name = oneLine(draft.name);
  if (draft.areaId !== before.areaId) patch.area_id = draft.areaId || null;
  if (draft.tz !== before.tz) patch.tz = draft.tz || null;
  if (draft.active !== before.active) patch.active = draft.active;
  return patch;
}

export function areaDraft(area?: AreaOut | null): AreaDraft {
  return { name: area?.name ?? "", tz: area?.tz ?? "" };
}

export function areaCreateBody(draft: AreaDraft): Schemas["AreaIn"] {
  const body: Schemas["AreaIn"] = { name: oneLine(draft.name) };
  if (draft.tz) body.tz = draft.tz;
  return body;
}

export function areaPatchBody(area: AreaOut, draft: AreaDraft): Schemas["AreaPatch"] {
  const before = areaDraft(area);
  const patch: Schemas["AreaPatch"] = {};
  if (oneLine(draft.name) !== before.name) patch.name = oneLine(draft.name);
  if (draft.tz !== before.tz) patch.tz = draft.tz || null;
  return patch;
}
