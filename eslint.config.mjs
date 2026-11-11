import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Two class names that keep coming back and that neither the type checker nor axe will catch.
 *
 * Written without backslash escapes on purpose: the selector grammar behind
 * `no-restricted-syntax` parses the regex itself and silently matches nothing if it contains
 * one, so `\d` and `\b` are spelled out as character classes. Verified against a probe file —
 * if you edit these, check the rule still fires before trusting it.
 */
const HUE =
  "(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)";
const PREFIX =
  "(text|bg|border|ring|from|via|to|fill|stroke|divide|outline|decoration|shadow|accent|caret)";
const RAW_PALETTE = `${PREFIX}-${HUE}-[0-9][0-9]?[0-9]?`;
/** `text-brand-fg` is deliberately allowed: that is text drawn *on* the brand fill, and
 *  readableOn() already picks it for contrast. */
const BRAND_AS_TEXT = "text-brand(?!-)";

const palette =
  "Use a semantic token (text-foreground, text-muted, bg-surface, text-danger, bg-success-subtle…) rather than Tailwind's raw palette, which cannot be themed. The tokens are defined in packages/shared/src/tokens.ts.";
const brand =
  "Use text-brand-ink for brand-coloured text. --brand is the operator's exact colour and a red brand fails 4.5:1 on --surface; --brand-ink is derived to pass on every surface. (text-brand-fg is fine.)";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `Literal[value=/${RAW_PALETTE}/]`, message: palette },
        { selector: `TemplateElement[value.raw=/${RAW_PALETTE}/]`, message: palette },
        { selector: `Literal[value=/${BRAND_AS_TEXT}/]`, message: brand },
        { selector: `TemplateElement[value.raw=/${BRAND_AS_TEXT}/]`, message: brand },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The browser tests build here (see distDir in next.config.ts).
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
