import type { Schemas } from "@crewstars/api-client";
import { useTranslations } from "next-intl";

import { QuerySelect } from "./QueryControls";

/**
 * The store filter (OP-01): All stores, or one, by its number in the URL (lib/store-scope.ts).
 * Open stores are offered; a closed one only while it is the one picked, so an old link still
 * says what it shows.
 */
export function StoreFilter({
  stores,
  selected,
  className,
}: {
  stores: readonly Pick<Schemas["StoreOut"], "id" | "number" | "name" | "active">[];
  /** The store in force, if any. */
  selected?: Pick<Schemas["StoreOut"], "id" | "number">;
  className?: string;
}) {
  const t = useTranslations("recognition.storeFilter");
  const offered = stores.filter((store) => store.active || store.id === selected?.id);
  return (
    <QuerySelect
      label={t("label")}
      param="store"
      value={selected?.number ?? ""}
      className={className}
      options={[
        { value: "", label: t("all") },
        ...offered.map((store) => ({ value: store.number, label: t("option", { number: store.number, name: store.name }) })),
      ]}
    />
  );
}
