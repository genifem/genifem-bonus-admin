import { DEFAULT_LOCALE, type Locale, MESSAGES, type Messages } from "./index";

/**
 * A tiny message lookup for clients without next-intl (the mobile app, bonus-app).
 *
 * Our catalogs use simple {name} placeholders, so this is a dotted-key lookup plus
 * replacement. If a catalog ever needs plurals or select, swap this for an ICU formatter
 * rather than growing it.
 */

export type Values = Record<string, string | number>;

function lookup(messages: Messages, key: string): string | undefined {
  let current: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : undefined;
}

export function fill(template: string, values: Values = {}): string {
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

export interface Translator {
  (key: string, values?: Values): string;
  has(key: string): boolean;
  locale: Locale;
}

export function createTranslator(locale: Locale): Translator {
  const messages = MESSAGES[locale] ?? MESSAGES[DEFAULT_LOCALE];
  const fallback = MESSAGES[DEFAULT_LOCALE];

  const translate = ((key: string, values?: Values) => {
    const template = lookup(messages, key) ?? lookup(fallback, key);
    // A missing key shows the key: loud in development, harmless in front of an owner.
    return template === undefined ? key : fill(template, values);
  }) as Translator;

  translate.has = (key: string) =>
    lookup(messages, key) !== undefined || lookup(fallback, key) !== undefined;
  translate.locale = locale;
  return translate;
}
