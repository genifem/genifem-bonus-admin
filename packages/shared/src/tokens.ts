/**
 * The single source of truth for colour, type, space and radius.
 *
 * Plain TypeScript with no dependencies, because three consumers read it and they cannot
 * agree on anything richer:
 *   - the web portal generates CSS variables from it (`scripts/tokens.mjs` → `src/app/tokens.css`),
 *   - the Expo app (bonus-app) imports the object directly, since React Native cannot read CSS
 *     variables,
 *   - `tokens.test.ts` asserts the pairings in `textContrast` actually pass WCAG 2.2 AA.
 *
 * Only erasable TypeScript syntax here: the generator runs this file through Node's type
 * stripping, which rejects `enum`, `namespace` and parameter properties.
 *
 * This file is copied verbatim into bonus-app. A change belongs in both checkouts.
 */

/**
 * The Crew Stars palette, from the prototype (plan §13). Components normally ask for a
 * semantic colour (below); the web also exposes these by name (`bg-butter`, `text-gold-ink`)
 * for the brand's own surfaces: coin pills, role chips, tag chips.
 *
 * Two reds, on purpose (plan D17): `red` is decorative only (icons, the mascot, large fills)
 * because white on it is 4.17:1 and it is 3.96:1 on cream. Anything that carries words -
 * a button with white text, a link, the current nav row - uses `redAction`.
 */
export const crewStars = {
  cream: "#FFF8F1",
  cream2: "#FBF1E6",
  paper: "#FFFFFF",
  ink: "#1E1A2B",
  muted: "#6B6379",
  line: "#EFE4D7",
  red: "#E63946",
  redAction: "#C92A37",
  redSoft: "#FFE4E6",
  redFaint: "#F6AEB3",
  butter: "#FFF1C2",
  butter2: "#FFE59A",
  gold: "#F5B700",
  goldInk: "#8A5A00",
  mint: "#DDF5E8",
  mintInk: "#1D6E47",
  sky: "#DCEBFF",
  skyInk: "#1F5AA0",
  lilac: "#EEE6FF",
  lilacInk: "#5B37B8",
  peach: "#FFE7D6",
  peachInk: "#A04A12",
  amber: "#FFF0CC",
  amberInk: "#8A5A00",
} as const;

/**
 * What a component asks for. The naming is consistent on purpose:
 *   `x`         the colour itself, used as a fill
 *   `x-fg`      text drawn *on* that fill
 *   `x-ink`     the darkened form, for text drawn on a light background
 *   `x-subtle`  the tinted background, for pills and alerts
 */
export const light = {
  // Cream page, white cards with a warm line around them: the prototype's owner portal.
  background: crewStars.cream,
  // Chips, wells, the flat panel.
  surface: crewStars.cream2,
  surfaceRaised: crewStars.paper,
  border: crewStars.line,
  // The edges that carry meaning (a field at rest, a dashed empty state) hold 3:1 on every
  // surface (WCAG 1.4.11); `border` is decorative and does not.
  borderStrong: "#8C8274",
  inputBorder: crewStars.line,
  controlBorder: "#8C8274",
  // Secondary buttons, chips and filter pills. Decorative: their words carry the meaning.
  buttonBorder: crewStars.line,
  // A switched-off control.
  disabled: crewStars.line,
  disabledFg: "#7A7187",
  track: crewStars.cream2,
  foreground: crewStars.ink,
  muted: crewStars.muted,

  // The brand fill carries white words (primary buttons), so it is the action red.
  brand: crewStars.redAction,
  brandInk: crewStars.redAction,
  brandStrong: crewStars.redAction,
  brandSubtle: crewStars.redSoft,
  brandFg: "#FFFFFF",

  accent: crewStars.gold,
  accentInk: crewStars.goldInk,
  accentFg: crewStars.ink,

  // The prototype's mint progress fill; light, so its -fg is ink.
  success: "#3FBF8F",
  successInk: crewStars.mintInk,
  successSubtle: crewStars.mint,
  successFg: crewStars.ink,

  warning: crewStars.gold,
  warningInk: crewStars.amberInk,
  warningSubtle: crewStars.amber,
  warningFg: crewStars.ink,

  danger: crewStars.redAction,
  dangerInk: crewStars.redAction,
  dangerSubtle: crewStars.redSoft,
  dangerFg: "#FFFFFF",

  info: crewStars.skyInk,
  infoInk: crewStars.skyInk,
  infoSubtle: crewStars.sky,
  infoFg: "#FFFFFF",

  reward: crewStars.lilacInk,
  rewardInk: crewStars.lilacInk,
  rewardSubtle: crewStars.lilac,
  rewardFg: "#FFFFFF",
} as const;

export type SemanticColor = keyof typeof light;
export type ColorScheme = Record<SemanticColor, string>;

/** Light only for v1 (the prototype has a single light look). */
export const schemes: Record<"light", ColorScheme> = { light };

/**
 * Every pairing the product actually draws, as [text, background]. `tokens.test.ts` walks
 * this list and fails under 4.5:1, so a palette edit cannot quietly break AA (NF-11).
 */
export const textContrast: ReadonlyArray<readonly [SemanticColor, SemanticColor]> = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["foreground", "surfaceRaised"],
  ["muted", "background"],
  ["muted", "surface"],
  ["muted", "surfaceRaised"],
  ["brandInk", "background"],
  ["brandInk", "surface"],
  ["brandInk", "surfaceRaised"],
  ["brandStrong", "brandSubtle"],
  ["brandFg", "brand"],
  ["rewardInk", "rewardSubtle"],
  ["rewardFg", "reward"],
  ["accentInk", "background"],
  ["accentInk", "surface"],
  ["accentFg", "accent"],
  ["successInk", "background"],
  ["successInk", "successSubtle"],
  ["successFg", "success"],
  ["warningInk", "background"],
  ["warningInk", "warningSubtle"],
  ["warningFg", "warning"],
  ["dangerInk", "background"],
  ["dangerInk", "surface"],
  ["dangerInk", "dangerSubtle"],
  ["dangerFg", "danger"],
  ["infoInk", "infoSubtle"],
  ["infoFg", "info"],
  ["foreground", "infoSubtle"],
];

/**
 * Boundaries that carry meaning — the edge of an input, a selected card — need 3:1 against
 * what they sit on (WCAG 1.4.11). `border` is decorative and deliberately not in this list.
 */
export const uiContrast: ReadonlyArray<readonly [SemanticColor, SemanticColor]> = [
  ["borderStrong", "background"],
  ["borderStrong", "surface"],
  ["controlBorder", "surfaceRaised"],
  ["controlBorder", "background"],
  ["controlBorder", "surface"],
  // The focus ring and a focused field's edge.
  ["brandInk", "surfaceRaised"],
  ["brandInk", "background"],
  ["brand", "background"],
  ["danger", "background"],
];

/**
 * The tinted pairs the prototype draws words on (role chips, tag chips, notes, the coin
 * pill), as [text, background] from `crewStars`. Checked at 4.5:1 like everything else.
 */
export const paletteContrast: ReadonlyArray<readonly [keyof typeof crewStars, keyof typeof crewStars]> = [
  ["goldInk", "butter"],
  ["goldInk", "cream"],
  ["mintInk", "mint"],
  ["skyInk", "sky"],
  ["lilacInk", "lilac"],
  ["peachInk", "peach"],
  ["amberInk", "amber"],
  ["redAction", "redSoft"],
  ["redAction", "cream"],
  ["redAction", "paper"],
  ["paper", "redAction"],
  ["paper", "ink"],
  ["ink", "butter"],
  ["ink", "redSoft"],
];

/**
 * The navigation rail: white, as the prototype's owner portal draws it, with the current row
 * in red-soft and its words in the action red. Kept as its own small scale so the rail can
 * change without bending the semantic one.
 */
export const sidebar = {
  bg: crewStars.paper,
  fg: crewStars.ink,
  muted: crewStars.muted,
  hoverBg: crewStars.cream,
  activeBg: crewStars.redSoft,
  activeFg: crewStars.redAction,
  border: crewStars.line,
} as const;

/** Text on the rail, checked the same way as everything else. */
export const sidebarTextContrast: ReadonlyArray<readonly [keyof typeof sidebar, keyof typeof sidebar]> = [
  ["fg", "bg"],
  ["muted", "bg"],
  ["fg", "hoverBg"],
  ["activeFg", "activeBg"],
];

/**
 * Tailwind-compatible names, so nothing moves when this takes over. The prototype draws
 * 26px page titles and 28px KPI numbers, which is where 3xl and 4xl sit.
 *
 * The 11, 13, 15 and 17px steps carry no line height on purpose: they set only the size and
 * inherit the line height, like the arbitrary sizes they replaced.
 */
export const typeScale = {
  "2xs": { size: "0.6875rem" },
  xs: { size: "0.75rem", line: "1rem" },
  caption: { size: "0.8125rem" },
  sm: { size: "0.875rem", line: "1.25rem" },
  body: { size: "0.9375rem" },
  base: { size: "1rem", line: "1.5rem" },
  title: { size: "1.0625rem" },
  lg: { size: "1.125rem", line: "1.75rem" },
  xl: { size: "1.25rem", line: "1.75rem" },
  "2xl": { size: "1.375rem", line: "1.75rem" },
  "3xl": { size: "1.625rem", line: "2rem" },
  "4xl": { size: "1.75rem", line: "2rem" },
} as const;

/**
 * The prototype's radii: 12 (nav rows, small buttons), 14 (fields), 18 (KPI tiles, mobile
 * cards), 20 (portal cards), 22 (the balance card), 28 (sheets). `sm` and `md` are the 6px
 * role chip and the 10px in-row input. These override Tailwind's names, so every existing
 * `rounded-*` takes the new value without touching a component.
 */
export const radius = {
  sm: "0.375rem",
  md: "0.625rem",
  compact: "0.75rem",
  lg: "0.875rem",
  xl: "1.125rem",
  "2xl": "1.25rem",
  "3xl": "1.375rem",
  "4xl": "1.75rem",
  full: "9999px",
} as const;

/**
 * Headings set at their default tracking look untuned at size. Negative tracking tightens
 * them as they grow (the prototype's titles are -0.5px at 26px).
 */
export const tracking = {
  tight: "-0.02em",
  snug: "-0.01em",
  normal: "0em",
  wide: "0.02em",
  widest: "0.08em",
} as const;

/** Steps in px, for React Native. The web multiplies Tailwind's 0.25rem unit instead. */
export const space = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

/** The smallest target a finger gets (NF-11). */
export const minTouchTarget = 44;

/**
 * One height per kind of surface. A shell names its density once (`data-density` on the web)
 * and every field and button inside follows it. Values in px.
 *   console  the owner portal's pages
 *   form     dialogs, side panels and the sign-in form
 *   touch    phone screens (the mobile app)
 */
export const controlDensity = {
  console: { height: 42, paddingX: 12, text: 14, radius: 12 },
  form: { height: 48, paddingX: 14, text: 16, radius: 14 },
  touch: { height: 52, paddingX: 14, text: 16, radius: 14 },
} as const;

/** The two button heights below the density scale: in-card and in-row actions. They still
 *  sit in a 44px row on touch layouts. */
export const buttonHeight = { xs: 32, sm: 38 } as const;

/**
 * Motion. Short enough that nothing waits on it: feedback (hover, press, focus) is fast, a
 * panel or dialog is base, a sheet that travels the height of a phone is sheet. Anything with
 * `prefers-reduced-motion` gets none of it.
 */
export const motion = {
  duration: { fast: 120, base: 200, slow: 280, sheet: 320 },
  easing: {
    standard: [0.2, 0, 0, 1],
    enter: [0, 0, 0.2, 1],
    exit: [0.4, 0, 1, 1],
  },
} as const;

/** Elevation, warm and low-contrast, tinted with ink as the prototype's are. rgba() so React
 *  Native's boxShadow reads the same strings. */
export const shadow = {
  panel: "0 8px 32px -8px rgba(30,26,43,0.16)",
  lift: "0 8px 18px rgba(201,42,55,0.22)",
  tab: "0 2px 6px rgba(30,26,43,0.08)",
  popover: "0 12px 32px rgba(30,26,43,0.12)",
  dialog: "0 30px 60px rgba(30,26,43,0.18)",
  raised: "0 16px 40px rgba(30,26,43,0.08)",
  thumb: "0 1px 3px rgba(0,0,0,0.2)",
} as const;

/** The type scale in px, for React Native. */
export const typePx = {
  "2xs": 11,
  xs: 12,
  caption: 13,
  sm: 14,
  body: 15,
  base: 16,
  title: 17,
  lg: 18,
  xl: 20,
  "2xl": 22,
  "3xl": 26,
  "4xl": 28,
} as const;

/** The radius scale in px, for React Native. */
export const radiusPx = {
  sm: 6,
  md: 10,
  compact: 12,
  lg: 14,
  xl: 18,
  "2xl": 20,
  "3xl": 22,
  "4xl": 28,
} as const;
