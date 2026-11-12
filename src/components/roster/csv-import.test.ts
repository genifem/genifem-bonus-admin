import type { Schemas } from "@crewstars/api-client";
import { MESSAGES } from "@crewstars/i18n";
import { describe, expect, it } from "vitest";

import {
  fileProblem,
  importSummary,
  MAX_CSV_CHARS,
  problemMessage,
  refusalMessage,
  rejectedMessage,
  reviewOrder,
  rowProblems,
  type ImportMessage,
} from "./csv-import";

const row = (line: number, action: Schemas["CsvRow"]["action"]): Schemas["CsvRow"] => ({
  line,
  action,
  eid: `E${line}`,
  name: `Person ${line}`,
  role: "crew",
  errors: action === "error" ? ["no store number '9999'"] : [],
  problems: action === "error" ? [{ code: "store_unknown", params: { value: "9999" } }] : [],
});

const whole = { rejected: null, rejected_code: null, rejected_params: {} };

describe("importSummary", () => {
  it("counts the file and allows an import when something would change", () => {
    const preview = {
      rows: [row(2, "create"), row(3, "update"), row(4, "error")],
      to_create: 1,
      to_update: 1,
      errors: 1,
      ...whole,
    };
    expect(importSummary(preview)).toEqual({ lines: 3, create: 1, update: 1, error: 1, canImport: true });
  });

  it("refuses a file the API rejected as a whole", () => {
    const preview = {
      rows: [],
      to_create: 0,
      to_update: 0,
      errors: 0,
      rejected: "missing required column(s): eid",
      rejected_code: "missing_columns",
      rejected_params: { columns: "eid" },
    };
    expect(importSummary(preview).canImport).toBe(false);
    expect(importSummary({ ...preview, rejected: null }).canImport).toBe(false);
  });

  it("has nothing to import when every line has a problem", () => {
    const preview = { rows: [row(2, "error")], to_create: 0, to_update: 0, errors: 1, ...whole };
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

describe("a line's problems in the owner's language (NF-02)", () => {
  it("words each code with the cell as typed", () => {
    expect(problemMessage({ code: "phone_invalid", params: { value: "555-12" } })).toEqual({
      key: "problems.phone_invalid",
      values: { value: "555-12" },
    });
    expect(problemMessage({ code: "eid_repeated", params: {} })).toEqual({ key: "problems.eid_repeated", values: {} });
    expect(problemMessage({ code: "store_has_gm", params: { name: "Monica Diaz" } })).toEqual({
      key: "problems.store_has_gm",
      values: { name: "Monica Diaz" },
    });
  });

  it("says an unknown store or area without the cell when the API sends none", () => {
    expect(problemMessage({ code: "store_unknown", params: {} })).toEqual({ key: "problems.store_unknownPlain", values: {} });
    expect(problemMessage({ code: "area_unknown", params: { value: "" } })).toEqual({
      key: "problems.area_unknownPlain",
      values: {},
    });
  });

  it("knows nothing of a code newer than the portal, or one missing its values", () => {
    expect(problemMessage({ code: "badge_unknown", params: { value: "x" } })).toBeNull();
    expect(problemMessage({ code: "gm_twice", params: {} })).toBeNull();
  });

  it("falls back to the API's English for a code it does not know, line by line", () => {
    expect(
      rowProblems({
        errors: ["no store number '9999'", "something new"],
        problems: [
          { code: "store_unknown", params: { value: "9999" } },
          { code: "brand_new", params: {} },
        ],
      }),
    ).toEqual([{ key: "problems.store_unknown", values: { value: "9999" } }, { text: "something new" }]);
    expect(rowProblems({ errors: ["eid is required"], problems: [] })).toEqual([{ text: "eid is required" }]);
  });
});

describe("why a whole file was refused", () => {
  it("words the preview's reason, with the owner's numbers", () => {
    expect(rejectedMessage("forbidden_columns", { columns: "dob, ssn" }, "remove the column(s) dob, ssn", "es")).toEqual({
      key: "rejectedReasons.forbidden_columns",
      values: { columns: "dob, ssn" },
    });
    expect(rejectedMessage("too_many_rows", { max: "5000" }, "more than 5,000 rows", "en")).toEqual({
      key: "rejectedReasons.too_many_rows",
      values: { max: "5,000" },
    });
    expect(rejectedMessage("not_csv", {}, "that isn't a CSV file", "en")).toEqual({
      key: "rejectedReasons.not_csv",
      values: {},
    });
  });

  it("falls back to the English, and is nothing when nothing was refused", () => {
    expect(rejectedMessage("encrypted", {}, "the file is encrypted", "es")).toEqual({ text: "the file is encrypted" });
    expect(rejectedMessage("missing_columns", {}, "missing required column(s): eid", "en")).toEqual({
      text: "missing required column(s): eid",
    });
    expect(rejectedMessage(null, {}, null, "en")).toBeNull();
  });

  it("reads an import's 422 the same way", () => {
    expect(refusalMessage({ reason: "missing_columns", params: { columns: "role" } }, "missing role", "en")).toEqual({
      key: "rejectedReasons.missing_columns",
      values: { columns: "role" },
    });
    expect(refusalMessage(undefined, "this file can't be imported", "en")).toEqual({ text: "this file can't be imported" });
  });
});

describe("the catalogs", () => {
  // Every code the API sends (CsvProblem, CsvPreview.rejected_code), with the values it sends.
  const said: ImportMessage[] = [
    ...[
      "eid_required",
      "eid_repeated",
      "name_required",
      "role_required",
      "store_required",
      "stores_required",
      "area_required",
      "store_unknown",
      "area_unknown",
    ].map((code) => problemMessage({ code, params: {} })),
    ...["eid_invalid", "role_invalid", "store_unknown", "area_unknown", "phone_invalid", "hire_date_invalid", "language_invalid"].map(
      (code) => problemMessage({ code, params: { value: "x" } }),
    ),
    problemMessage({ code: "gm_twice", params: { other: "Ana" } }),
    problemMessage({ code: "store_has_gm", params: { name: "Ana" } }),
    rejectedMessage("not_csv", {}, null, "en"),
    rejectedMessage("no_header", {}, null, "en"),
    rejectedMessage("forbidden_columns", { columns: "ssn" }, null, "en"),
    rejectedMessage("missing_columns", { columns: "eid" }, null, "en"),
    rejectedMessage("too_many_rows", { max: "5000" }, null, "en"),
  ].filter((message): message is ImportMessage => message !== null);

  it.each(["en", "es"] as const)("%s words every code, with the values it is given", (locale) => {
    expect(said).toHaveLength(23);
    const catalog = MESSAGES[locale].roster.import as unknown as Record<string, Record<string, string>>;
    for (const message of said) {
      expect("key" in message, JSON.stringify(message)).toBe(true);
      if (!("key" in message)) continue;
      const [group, code] = message.key.split(".");
      const text = catalog[group!]?.[code!];
      expect(text, message.key).toBeTypeOf("string");
      const needs = [...text!.matchAll(/\{\s*(\w+)\s*[},]/g)].map((match) => match[1]);
      expect(Object.keys(message.values).sort(), message.key).toEqual([...new Set(needs)].sort());
    }
  });
});
