import type { Schemas } from "@crewstars/api-client";
import { Wallet } from "lucide-react";
import { useFormatter, useLocale, useTranslations } from "next-intl";

import { cx } from "@/components/ui/cx";

import { formatCount } from "./numbers";

/**
 * What is left of the owner's recognition budget this month (OP-07), and when it resets. A
 * shout-out from an owner is paid from this allowance, never from anyone's balance, which the
 * note says in words. Drawn by the server page and by the shout-out form alike.
 */
export function BudgetNote({ kudos, className }: { kudos: Schemas["KudosOut"]; className?: string }) {
  const t = useTranslations("recognition.recognize");
  const format = useFormatter();
  const locale = useLocale();
  const resets = format.dateTime(new Date(`${kudos.resets_on}T00:00:00Z`), {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <div className={cx("flex items-start gap-2.5 rounded-lg bg-surface p-3 text-sm", className)}>
      <Wallet aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-gold-ink" strokeWidth={2.2} />
      <p className="tabular-nums">
        {t.rich("budget", {
          left: formatCount(kudos.left, locale),
          total: formatCount(kudos.allowance + kudos.bonus, locale),
          b: (chunks) => <b className="font-black">{chunks}</b>,
        })}{" "}
        {t("resets", { date: resets })}
      </p>
    </div>
  );
}
