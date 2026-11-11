import type { Schemas } from "@crewstars/api-client";

/**
 * The CSV import, as plain data: what a preview means for the Import button, and the order
 * its lines are shown in. Pure, so it can be tested on its own.
 */

type CsvRow = Schemas["CsvRow"];
type CsvPreview = Schemas["CsvPreview"];

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
    canImport: !preview.rejected && preview.to_create + preview.to_update > 0,
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
