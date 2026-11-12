"use client";

import { Download } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useState } from "react";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";
import { apiDownload, ApiCallError } from "@/lib/api";

import { monthStart, payrollFileName, payrollPath } from "./payroll";

/**
 * "Download payroll export" with its month (NF-12, plan G4): the approved cash and gift-card
 * rewards of that month as a CSV, for every store.
 *
 * It is a GET form on the BFF's own address, so it works as a plain link would; with
 * JavaScript the file is fetched instead and saved under the API's name, and a refusal (a
 * session that ended, a month the API will not take) is said here in words rather than
 * replacing the page.
 */
export function PayrollExport({ months, initial }: { months: readonly string[]; initial: string }) {
  const t = useTranslations("redemptions.payroll");
  const te = useTranslations("errors");
  const format = useFormatter();
  const toast = useToast();
  const [month, setMonth] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const name = (key: string) => format.dateTime(monthStart(key), { month: "long", year: "numeric", timeZone: "UTC" });

  async function download(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, disposition } = await apiDownload(payrollPath(month));
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = payrollFileName(month, disposition);
      document.body.append(link);
      link.click();
      link.remove();
      // Long enough for the browser to have started saving it.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast.show(t("downloaded", { month: name(month) }));
    } catch (err) {
      const code = err instanceof ApiCallError ? err.code : "generic";
      setError(te.has(code) ? te(code) : te("generic"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      action="/api/v1/portal/redemptions/payroll.csv"
      method="get"
      onSubmit={(event) => void download(event)}
      className="flex flex-wrap items-end gap-3"
    >
      <div className="w-full sm:w-60">
        <SelectField label={t("month")} name="month" value={month} onChange={(event) => setMonth(event.target.value)}>
          {months.map((key) => (
            <option key={key} value={key}>
              {name(key)}
            </option>
          ))}
        </SelectField>
      </div>
      <Button
        type="submit"
        size="console"
        loading={busy}
        className="w-full sm:w-auto"
        icon={<Download aria-hidden="true" className="size-4.5" strokeWidth={2.2} />}
      >
        {t("download")}
      </Button>
      {error ? <Alert className="w-full">{error}</Alert> : null}
    </form>
  );
}
