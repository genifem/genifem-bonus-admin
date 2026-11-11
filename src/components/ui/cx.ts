/** Joins class names, dropping anything falsy. A dependency would buy nothing over this. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
