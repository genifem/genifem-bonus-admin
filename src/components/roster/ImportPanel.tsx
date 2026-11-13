"use client";

import type { Schemas } from "@crewstars/api-client";
import { Download, FileUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";

import {
  Alert,
  Badge,
  Button,
  buttonClass,
  Card,
  cx,
  DataTable,
  fieldFocus,
  Label,
  type BadgeTone,
  type Column,
} from "@/components/ui";
import { apiPost, ApiCallError } from "@/lib/api";

import {
  fileProblem,
  importSummary,
  refusalMessage,
  rejectedMessage,
  reviewOrder,
  rowProblems,
  type ImportMessage,
} from "./csv-import";

type CsvPreview = Schemas["CsvPreview"];
type CsvResult = Schemas["CsvResult"];
type CsvRow = Schemas["CsvRow"];

/** The roles a line can name, said in the owner's language when the cell is one of them. */
const ROLES = new Set(["crew", "shift", "gm", "supervisor", "director"]);

/** Lines drawn in the preview; the counts above it are always the whole file's. */
const SHOWN = 500;

const ACTION_TONE: Record<CsvRow["action"], BadgeTone> = {
  create: "success",
  update: "brand",
  error: "danger",
};

/**
 * The Import tab (plan D20, ported from Geniverse): download the template, choose a CSV, see
 * what it would do line by line (nothing is written), then import. Lines with errors are
 * skipped and listed; the rest are applied. An Excel file, a file missing a required column,
 * or one with a column Crew Stars never keeps (an SSN, a birth date) is refused as a whole.
 *
 * The file is read here, in the browser, and sent as text: it never touches a disk on the way.
 *
 * What is wrong with a line or a file comes from the API as codes with their values
 * (CsvProblem, `rejected_code`), said here in the owner's language (NF-02); a code newer than
 * this portal is shown in the API's English rather than not at all.
 */
export function ImportPanel() {
  const t = useTranslations("roster.import");
  const te = useTranslations("errors");
  const tRoles = useTranslations("roster.roles");
  const locale = useLocale();
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [result, setResult] = useState<CsvResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"read" | "preview" | "import" | null>(null);

  const say = (message: ImportMessage) => ("key" in message ? t(message.key, message.values) : message.text);

  function failure(err: unknown): string {
    if (!(err instanceof ApiCallError)) return te("generic");
    // The file changed between the check and the import, or was never checked: the 422 says
    // why as a code (details.reason), like the preview.
    if (err.code === "csv_rejected") return t("rejected", { reason: say(refusalMessage(err.details, err.message, locale)) });
    return te.has(err.code) ? te(err.code) : te("generic");
  }

  async function choose(file: File | undefined) {
    setPreview(null);
    setResult(null);
    setError(null);
    setCsv(null);
    setFileName(file?.name ?? null);
    if (!file) return;
    setBusy("read");
    try {
      const text = await file.text();
      const problem = fileProblem(text);
      if (problem) setError(problem === "csv_empty" ? t("csv_empty") : t("csv_too_big"));
      else setCsv(text);
    } catch {
      setError(t("csv_unreadable"));
    }
    setBusy(null);
  }

  async function runPreview() {
    if (!csv) return;
    setBusy("preview");
    setError(null);
    setResult(null);
    try {
      setPreview(await apiPost<CsvPreview>("/portal/people/import/preview", { csv }));
    } catch (err) {
      setError(failure(err));
    }
    setBusy(null);
  }

  async function runImport() {
    if (!csv) return;
    setBusy("import");
    setError(null);
    try {
      const done = await apiPost<CsvResult>("/portal/people/import", { csv });
      setResult(done);
      setPreview(null);
      setCsv(null);
      setFileName(null);
      if (input.current) input.current.value = "";
      // The People tab, the stores' GMs and the areas' directors all moved.
      router.refresh();
    } catch (err) {
      setError(failure(err));
    }
    setBusy(null);
  }

  const summary = preview ? importSummary(preview) : null;
  const rows = preview ? reviewOrder(preview.rows) : [];
  const rejected = preview
    ? rejectedMessage(preview.rejected_code, preview.rejected_params, preview.rejected, locale)
    : null;

  const columns: Column<CsvRow>[] = [
    { key: "line", header: t("columns.line"), align: "end", width: "min", cell: (row) => row.line },
    {
      key: "action",
      header: t("columns.action"),
      cell: (row) => <Badge tone={ACTION_TONE[row.action]}>{t(`actions.${row.action}`)}</Badge>,
    },
    { key: "eid", header: t("columns.eid"), overflow: "nowrap", cell: (row) => <span className="font-mono">{row.eid ?? "—"}</span> },
    { key: "name", header: t("columns.name"), overflow: "wrap", cell: (row) => row.name ?? "—" },
    {
      key: "role",
      header: t("columns.role"),
      overflow: "nowrap",
      cell: (row) => {
        const role = row.role?.trim().toLowerCase() ?? "";
        return ROLES.has(role) ? tRoles(role) : (row.role ?? "—");
      },
    },
    {
      key: "errors",
      header: t("columns.problems"),
      overflow: "wrap",
      stack: "full",
      cell: (row) => {
        const problems = rowProblems(row);
        return problems.length > 0 ? (
          <ul className="flex list-disc flex-col gap-0.5 pl-4 text-danger-ink">
            {problems.map((problem, index) => (
              <li key={index}>{say(problem)}</li>
            ))}
          </ul>
        ) : (
          <span className="text-muted">{t("noProblems")}</span>
        );
      },
    },
  ];

  return (
    <section aria-labelledby="import-heading" className="flex flex-col gap-4">
      <Card padding="lg" className="flex flex-col gap-4">
        <div>
          <h2 id="import-heading" className="text-title font-black tracking-normal">
            {t("heading")}
          </h2>
          <p className="mt-1 max-w-[70ch] text-sm text-muted">{t("lead")}</p>
        </div>
        <ul className="flex max-w-[70ch] list-disc flex-col gap-1 pl-5 text-sm">
          <li>{t("ruleColumns")}</li>
          <li>{t("rulePlacement")}</li>
          <li>{t("ruleUpdate")}</li>
          <li>{t("ruleNever")}</li>
        </ul>
        <div>
          <a
            href="/api/v1/portal/people/import/template"
            download="crew-stars-roster.csv"
            className={buttonClass({ variant: "secondary", size: "console" })}
          >
            <Download aria-hidden="true" className="size-4" strokeWidth={2} />
            {t("template")}
          </a>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={inputId}>{t("file")}</Label>
          <input
            ref={input}
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            aria-describedby={`${inputId}-hint`}
            disabled={busy !== null}
            onChange={(event) => void choose(event.target.files?.[0])}
            className={cx(
              "block w-full max-w-md min-h-11 cursor-pointer rounded-(--control-radius) border border-control-border bg-surface-raised p-1 text-sm",
              "file:mr-3 file:min-h-9 file:cursor-pointer file:rounded-compact file:border file:border-button-border file:bg-surface file:px-3 file:font-extrabold file:text-foreground",
              fieldFocus,
            )}
          />
          <p id={`${inputId}-hint`} className="text-caption text-muted">
            {fileName ? t("chosen", { name: fileName }) : t("fileHint")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <Button
            size="console"
            variant="secondary"
            icon={<FileUp aria-hidden="true" className="size-4" strokeWidth={2} />}
            disabled={!csv || busy !== null}
            loading={busy === "preview"}
            onClick={() => void runPreview()}
          >
            {t("preview")}
          </Button>
          {summary?.canImport ? (
            <Button size="console" loading={busy === "import"} disabled={busy !== null} onClick={() => void runImport()}>
              {t("commit", { count: summary.create + summary.update })}
            </Button>
          ) : null}
        </div>

        {error ? <Alert kind="error">{error}</Alert> : null}

        {result ? (
          <Alert kind="success">
            {t("done", { created: result.created, updated: result.updated, failed: result.failed })}{" "}
            <Link href="/roster" className="font-extrabold underline underline-offset-2">
              {t("seePeople")}
            </Link>
          </Alert>
        ) : null}
      </Card>

      {preview && summary ? (
        <section aria-labelledby="preview-heading" className="flex flex-col gap-3">
          <h2 id="preview-heading" className="text-title font-black tracking-normal">
            {t("previewHeading")}
          </h2>
          {rejected ? (
            <Alert kind="error">{t("rejected", { reason: say(rejected) })}</Alert>
          ) : (
            <>
              <p role="status" className="text-sm">
                {t("counts", { lines: summary.lines, create: summary.create, update: summary.update, error: summary.error })}
              </p>
              {summary.error > 0 ? <Alert kind="warning">{t("skipped", { count: summary.error })}</Alert> : null}
              {rows.length > 0 ? (
                <DataTable
                  caption={t("caption")}
                  columns={columns}
                  rows={rows.slice(0, SHOWN)}
                  rowKey={(row) => String(row.line)}
                  // Up to 500 lines: one box that scrolls under its own header, never taller
                  // than most of the screen, so its end and the page's stay in reach.
                  stickyHeader={{ maxHeight: "min(32rem, 70dvh)" }}
                />
              ) : null}
              {rows.length > SHOWN ? <p className="text-caption text-muted">{t("truncated", { shown: SHOWN, total: rows.length })}</p> : null}
            </>
          )}
        </section>
      ) : null}
    </section>
  );
}
