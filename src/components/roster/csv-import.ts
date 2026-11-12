import type { Schemas } from "@crewstars/api-client";

import { formatCount } from "@/components/recognition/numbers";

/**
 * The CSV import, as plain data: what a preview means for the Import button, the order its
 * lines are shown in, and what is wrong with a line or a whole file in the owner's language.
 * Pure, so it can be tested on its own.
 */

type CsvRow = Schemas["CsvRow"];
type CsvPreview = Schemas["CsvPreview"];
type CsvProblem = Schemas["CsvProblem"];

/** The API takes a file of up to 2,000,000 characters (CsvIn). */
export const MAX_CSV_CHARS = 2_000_000;

export interface ImportSummary {
  /** Lines read, header not counted. */
  lines: number;
  create: number;
  update: number;
  error: number;
  /** Something to import, and the file as a whole was readable. Lines with errors are
   *  skipped and reported; they do not stop the rest. */
  canImport: boolean;
}

export function importSummary(preview: CsvPreview): ImportSummary {
  return {
    lines: preview.rows.length,
    create: preview.to_create,
    update: preview.to_update,
    error: preview.errors,
    canImport: !preview.rejected && !preview.rejected_code && preview.to_create + preview.to_update > 0,
  };
}

const RANK: Record<CsvRow["action"], number> = { error: 0, create: 1, update: 2 };

/** The lines to fix first: errors, then new people, then updates, each in file order. */
export function reviewOrder(rows: readonly CsvRow[]): CsvRow[] {
  return [...rows].sort((a, b) => RANK[a.action] - RANK[b.action] || a.line - b.line);
}

/** Why a chosen file cannot be sent at all, before asking the API: empty, or too big for it. */
export function fileProblem(text: string): "csv_empty" | "csv_too_big" | null {
  if (text.trim() === "") return "csv_empty";
  if (text.length > MAX_CSV_CHARS) return "csv_too_big";
  return null;
}

/**
 * Something to tell the owner about the file: a message under `roster.import` with its
 * values, or the API's own English when the portal does not know the code yet (an API newer
 * than the portal still says what is wrong, in English, rather than nothing).
 */
export type ImportMessage = { key: string; values: Record<string, string> } | { text: string };

/** Each line problem the API words as a code (CsvProblem, NF-02), and the values its message
 *  needs. `value` is the cell as typed. */
const PROBLEM_PARAMS: Record<string, readonly string[]> = {
  eid_required: [],
  eid_invalid: ["value"],
  eid_repeated: [],
  name_required: [],
  role_required: [],
  role_invalid: ["value"],
  store_unknown: ["value"],
  area_unknown: ["value"],
  phone_invalid: ["value"],
  hire_date_invalid: ["value"],
  language_invalid: ["value"],
  store_required: [],
  stores_required: [],
  area_required: [],
  gm_twice: ["other"],
  store_has_gm: ["name"],
};

/** Codes that also come without their value (from the check of where someone works), said
 *  then without it. */
const SAID_PLAIN = new Set(["store_unknown", "area_unknown"]);

/** What makes the API refuse a whole file, and the values each needs. */
const REJECTED_PARAMS: Record<string, readonly string[]> = {
  not_csv: [],
  no_header: [],
  forbidden_columns: ["columns"],
  missing_columns: ["columns"],
  too_many_rows: ["max"],
};

/** The values a message needs, when every one of them came. */
function pick(params: Record<string, unknown> | null | undefined, names: readonly string[]): Record<string, string> | null {
  const values: Record<string, string> = {};
  for (const name of names) {
    const value = params?.[name];
    if (typeof value !== "string" || value === "") return null;
    values[name] = value;
  }
  return values;
}

/** One line problem in the owner's language, or null for a code the portal does not know. */
export function problemMessage(problem: CsvProblem): ImportMessage | null {
  const names = PROBLEM_PARAMS[problem.code];
  if (!names) return null;
  const values = pick(problem.params, names);
  if (values) return { key: `problems.${problem.code}`, values };
  return SAID_PLAIN.has(problem.code) ? { key: `problems.${problem.code}Plain`, values: {} } : null;
}

/** Everything wrong with a line: each code in words, or the API's English beside it when the
 *  code is new (the two lists are in step). An API that sends no codes is shown as it was. */
export function rowProblems(row: Pick<CsvRow, "errors" | "problems">): ImportMessage[] {
  const problems = row.problems ?? [];
  if (problems.length === 0) return row.errors.map((text) => ({ text }));
  return problems.map((problem, index) => problemMessage(problem) ?? { text: row.errors[index] ?? problem.code });
}

/**
 * Why a whole file was refused, from the preview (`rejected_code`, `rejected_params`) or from
 * an import's 422 `csv_rejected` (`details.reason`, `details.params`). A row limit is written
 * as the owner's numbers are ("5,000"). Null when nothing was refused.
 */
export function rejectedMessage(
  code: string | null | undefined,
  params: Record<string, unknown> | null | undefined,
  english: string | null | undefined,
  locale: string,
): ImportMessage | null {
  const names = code ? REJECTED_PARAMS[code] : undefined;
  const values = names ? pick(params, names) : null;
  if (code && values) {
    if (values.max && /^\d+$/.test(values.max)) values.max = formatCount(Number(values.max), locale);
    return { key: `rejectedReasons.${code}`, values };
  }
  return english ? { text: english } : null;
}

/** The reason in an import's 422 `csv_rejected`, whose message is the API's English. */
export function refusalMessage(details: unknown, english: string, locale: string): ImportMessage {
  const { reason, params } = (typeof details === "object" && details !== null ? details : {}) as {
    reason?: unknown;
    params?: unknown;
  };
  return (
    rejectedMessage(
      typeof reason === "string" ? reason : null,
      typeof params === "object" && params !== null ? (params as Record<string, unknown>) : null,
      english,
      locale,
    ) ?? { text: english }
  );
}
