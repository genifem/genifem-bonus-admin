/**
 * What a refused write means for the form that sent it: which field to put the message next
 * to, and which message (`errors.<code>`, with its values).
 *
 * The API names the field itself on a 422 (`details.field`). A 409 does not, so the codes that
 * clash with one field are mapped here (`store_has_gm` belongs beside the store). A request
 * the schema refused (`validation_failed`) lists every field it refused under
 * `details.fields`, keyed by path (`eid`, `store_ids.0`, or `request` for the whole body);
 * its messages are the API's English, so the form says it in its own words per field.
 *
 * Pure, so it can be tested without a browser.
 */

/** As much of an ApiCallError as this needs. */
export interface ApiFailure {
  status: number;
  code: string;
  details?: unknown;
}

export interface Problem {
  /** The field as the API names it (`store_id`, `phone`), or null for the form as a whole. */
  field: string | null;
  /** The error code: the message is `errors.<code>`, or for `validation_failed` on a known
   *  field, the form's own hint for that field. */
  code: string;
  /** ICU values for the message: `name` (whoever already holds the place), `people`. */
  values: Record<string, string | number>;
}

/** The conflicts that are about one field, though the API does not say which. */
const FIELD_OF_CODE: Record<string, string> = {
  eid_taken: "eid",
  store_has_gm: "store_id",
  store_has_supervisor: "store_ids",
  area_has_director: "area_id",
  store_number_taken: "number",
  area_name_taken: "name",
  store_has_people: "active",
  // A reward's unlock names a badge the settings no longer have (OP-11).
  unlock_invalid: "unlock",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The form field a validation path is about: its first part (`store_ids.0` is the stores
 *  list), or none for the request as a whole. */
function fieldOfPath(path: string): string | null {
  const field = path.split(".")[0] ?? "";
  return field === "" || field === "request" ? null : field;
}

export function describeFailure(failure: ApiFailure): Problem[] {
  const details = isRecord(failure.details) ? failure.details : {};

  if (failure.code === "validation_failed" && isRecord(details.fields)) {
    const fields = [...new Set(Object.keys(details.fields).map(fieldOfPath))];
    const problems = fields.map((field) => ({ field, code: "validation_failed", values: {} }));
    return problems.length ? problems : [{ field: null, code: "validation_failed", values: {} }];
  }

  const values: Record<string, string | number> = {};
  if (typeof details.name === "string") values.name = details.name;
  if (typeof details.people === "number") values.people = details.people;
  const field =
    typeof details.field === "string" ? details.field : (FIELD_OF_CODE[failure.code] ?? null);
  return [{ field, code: failure.code, values }];
}

/**
 * Splits problems between the fields a form shows and the alert above its buttons: a problem
 * about a field the form does not have (or about no field) is said in the alert.
 */
export function placeProblems(
  problems: readonly Problem[],
  fields: readonly string[],
): { byField: Record<string, Problem>; general: Problem[] } {
  const byField: Record<string, Problem> = {};
  const general: Problem[] = [];
  for (const problem of problems) {
    if (problem.field !== null && fields.includes(problem.field) && !byField[problem.field]) {
      byField[problem.field] = problem;
    } else {
      general.push(problem);
    }
  }
  return { byField, general };
}
