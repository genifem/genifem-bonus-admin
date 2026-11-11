import type { Schemas } from "@crewstars/api-client";
import { describe, expect, it } from "vitest";

import { fileProblem, importSummary, MAX_CSV_CHARS, reviewOrder } from "./csv-import";

const row = (line: number, action: Schemas["CsvRow"]["action"]): Schemas["CsvRow"] => ({
  line,
  action,
  eid: `E${line}`,
  name: `Person ${line}`,
  role: "crew",
  errors: action === "error" ? ["no store number '9999'"] : [],
});

describe("importSummary", () => {
  it("counts the file and allows an import when something would change", () => {
    const preview = {
      rows: [row(2, "create"), row(3, "update"), row(4, "error")],
      to_create: 1,
      to_update: 1,
      errors: 1,
      rejected: null,
    };
    expect(importSummary(preview)).toEqual({ lines: 3, create: 1, update: 1, error: 1, canImport: true });
  });

  it("refuses a file the API rejected as a whole", () => {
    const preview = { rows: [], to_create: 0, to_update: 0, errors: 0, rejected: "missing required column(s): eid" };
    expect(importSummary(preview).canImport).toBe(false);
  });

  it("has nothing to import when every line has a problem", () => {
    const preview = { rows: [row(2, "error")], to_create: 0, to_update: 0, errors: 1, rejected: null };
    expect(importSummary(preview).canImport).toBe(false);
  });
});

describe("reviewOrder", () => {
  it("shows the problems first, then new people, then updates, each in file order", () => {
    const rows = [row(2, "update"), row(3, "create"), row(4, "error"), row(5, "create"), row(6, "error")];
    expect(reviewOrder(rows).map((r) => r.line)).toEqual([4, 6, 3, 5, 2]);
    // The preview itself is left as it came.
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5, 6]);
  });
});

describe("fileProblem", () => {
  it("catches an empty file and one too big to send", () => {
    expect(fileProblem("")).toBe("csv_empty");
    expect(fileProblem(" \n\n ")).toBe("csv_empty");
    expect(fileProblem("x".repeat(MAX_CSV_CHARS + 1))).toBe("csv_too_big");
    expect(fileProblem("eid,name,role\n2741001,Maria,crew\n")).toBeNull();
  });
});
