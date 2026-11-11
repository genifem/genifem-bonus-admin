/**
 * The time zones offered for a store or an area: the operator is in the US (plan D7: months,
 * the monthly reset and quiet hours run in a store's time zone). Any IANA name the API already
 * holds is kept and shown as it is, even if it is not one of these. Blank means the operator's
 * default.
 */
export const ZONES = [
  { id: "America/New_York", key: "eastern" },
  { id: "America/Chicago", key: "central" },
  { id: "America/Denver", key: "mountain" },
  { id: "America/Phoenix", key: "arizona" },
  { id: "America/Los_Angeles", key: "pacific" },
  { id: "America/Anchorage", key: "alaska" },
  { id: "Pacific/Honolulu", key: "hawaii" },
  { id: "America/Puerto_Rico", key: "atlantic" },
] as const;

export type ZoneKey = (typeof ZONES)[number]["key"];

/** The translation key (`roster.zones.<key>`) for a zone in the list, or null for another. */
export function zoneKey(id: string | null | undefined): ZoneKey | null {
  return ZONES.find((zone) => zone.id === id)?.key ?? null;
}
