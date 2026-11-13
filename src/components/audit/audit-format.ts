import type { Schemas } from "@crewstars/api-client";

import type { PortalKey } from "@/components/console/nav";
import { zoneKey } from "@/components/roster/zones";

/**
 * How the audit log (NF-09) says an event: one sentence for what happened ("Grant changed
 * Coins & limits", "Monica Diaz approved Free drink", "Grant terminated Rosa Vega"), the
 * values before and after, and anything else the action recorded (import counts...).
 *
 * Everything here is data: a `Word` is a message key with its values, a name as it is, a
 * count, a list. AuditEntry turns words into text in the owner's language (NF-02), so the
 * same event reads in English or Spanish, and the field labels are the ones the rule pages
 * already use ("Crew: monthly kudos allowance", "Silver starts at"). Pure, so it can be tested
 * on its own, and so the tests can check every key it can produce is in the catalog.
 *
 * An action, a field or a value this file does not know is still shown, as the API wrote it:
 * a new kind of event never disappears from the log because the portal is older than the API.
 */

type AuditEvent = Schemas["AuditEventOut"];
type Rules = Schemas["Rules"];
type Prize = Schemas["Prize"];

/** Something to say. AuditEntry's `say` turns it into text. */
export type Word =
  | { text: string }
  | { msg: string; values?: Record<string, Word | number> }
  | { list: Word[] }
  | { count: number }
  | { usd: number }
  /** An ISO date ("2026-11-03"), written out in the owner's language. */
  | { day: string }
  /** A month as the API keys it ("2026-11"), as its name and year. */
  | { month: string };

/** The action's sentence: a message under `audit.sentences`, with `<b>` around who did it. */
export interface Sentence {
  key: string;
  values: Record<string, Word | number>;
}

/** One value that changed. `before` null: it was added (a new record shows only these);
 *  `after` null: it was removed (a deleted reward shows what it was). */
export interface ChangeRow {
  key: string;
  field: Word;
  before: Word | null;
  after: Word | null;
}

export interface DetailRow {
  key: string;
  field: Word;
  value: Word;
}

/**
 * Names for the ids an event holds, read by the page beside the log: store and area names,
 * and the tiers, badges, award categories and prizes in the settings (in the owner's
 * language). Each may be empty: an id with no name is said generically.
 */
export interface AuditBook {
  locale: string;
  stores: Record<string, { number: string; name: string }>;
  areas: Record<string, string>;
  tiers: Record<string, string>;
  badges: Record<string, { name: string; rule: string }>;
  awards: Record<string, string>;
  prizes: Record<string, string>;
}

export function emptyBook(locale: string): AuditBook {
  return { locale, stores: {}, areas: {}, tiers: {}, badges: {}, awards: {}, prizes: {} };
}

const spanish = (locale: string) => locale.startsWith("es");
const localName = (item: { name: string; name_es?: string | null }, locale: string) =>
  spanish(locale) && item.name_es ? item.name_es : item.name;
const prizeName = (prize: Pick<Prize, "label" | "label_es">, locale: string) =>
  spanish(locale) && prize.label_es ? prize.label_es : prize.label;

/** The book from what the page read; any of the three may be missing. */
export function auditBook(
  sources: {
    stores?: readonly { id: string; number: string; name: string }[] | null;
    areas?: readonly { id: string; name: string }[] | null;
    rules?: Pick<Rules, "tiers" | "badges" | "awards" | "spin"> | null;
  },
  locale: string,
): AuditBook {
  const book = emptyBook(locale);
  for (const store of sources.stores ?? []) book.stores[store.id] = { number: store.number, name: store.name };
  for (const area of sources.areas ?? []) book.areas[area.id] = area.name;
  const rules = sources.rules;
  if (rules) {
    for (const tier of rules.tiers) book.tiers[tier.id] = localName(tier, locale);
    for (const badge of rules.badges) book.badges[badge.id] = { name: localName(badge, locale), rule: badge.rule };
    for (const award of rules.awards) book.awards[award.id] = localName(award, locale);
    for (const prize of rules.spin.prizes) book.prizes[prize.id] = prizeName(prize, locale);
  }
  return book;
}

// -- small readers ---------------------------------------------------------------------------

type Json = Record<string, unknown>;

const isRecord = (value: unknown): value is Json =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const msg = (key: string, values?: Record<string, Word | number>): Word => (values ? { msg: key, values } : { msg: key });
const sentence = (name: string, values: Record<string, Word | number>): Sentence => ({
  key: `audit.sentences.${name}`,
  values,
});
/** Two stored values are the same value (a list or an object compared by its contents). */
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

const ROLES = ["crew", "shift", "gm", "supervisor", "director"] as const;
const COIN_ROLES = [...ROLES, "owner"] as const;
const TAGS = ["guest", "rush", "team", "clean", "above", "lead"] as const;
const SCOPES = ["store", "stores", "area", "all"] as const;
const PRIZE_KINDS = ["coins", "kudos", "item", "badge"] as const;
const REQUEST_STATUSES = ["pending", "approved", "collected", "declined", "cancelled"] as const;
const ICONS = ["burger", "cup", "calendar", "gift", "shirt", "sun", "fries", "star"] as const;
const UNLOCKS = ["none", "tier", "badge"] as const;

const known = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);

// -- who and what ----------------------------------------------------------------------------

/** Who did it: their name; Crew Stars itself for a scheduled job or a security response; or,
 *  for someone since removed, an owner or someone. */
export function actorWord(actor: AuditEvent["actor"]): Word {
  if (actor.type === "system") return msg("audit.actor.system");
  const name = str(actor.name);
  if (name) return { text: name };
  return msg(actor.type === "owner" ? "audit.actor.owner" : "audit.actor.person");
}

/** What it was about, by its name, or generically by its type ("someone", "a reward"). */
function targetWord(event: AuditEvent, fallback: "person" | "reward" | "store" | "area"): Word {
  const label = str(event.target?.label);
  return label ? { text: label } : msg(`audit.unknown.${fallback}`);
}

/** A store as the pages name one: "2741 · Main St". */
function storeWord(id: unknown, book: AuditBook): Word {
  const store = typeof id === "string" ? book.stores[id] : undefined;
  return store
    ? msg("recognition.storeFilter.option", { number: { text: store.number }, name: { text: store.name } })
    : msg("audit.unknown.store");
}

function tagWord(tag: unknown): Word {
  return known(TAGS, tag) ? msg(`recognition.tags.${tag}`) : { text: String(tag ?? "") };
}

// -- the sentence ----------------------------------------------------------------------------

/** Which page of the portal each top-level setting is set on. */
const SECTION_OF: Record<string, PortalKey> = {
  allowance: "coins",
  amounts: "coins",
  scope: "coins",
  upward: "coins",
  redeem: "coins",
  coin_value: "coins",
  spin: "spin",
  tiers: "badges",
  badges: "badges",
  awards: "awards",
};

/** The pages a settings change touched, by their names on the rail, in the order changed. */
export function settingsSections(event: Pick<AuditEvent, "before" | "after">): PortalKey[] {
  const paths = [...Object.keys(event.after ?? {}), ...Object.keys(event.before ?? {})];
  const sections: PortalKey[] = [];
  for (const path of paths) {
    const section = SECTION_OF[path.split(".")[0] ?? ""];
    if (section && !sections.includes(section)) sections.push(section);
  }
  return sections;
}

/** The decisions on a reward request (OP-09): approve, decline, mark collected (plan G5). */
const DECISIONS: Record<string, string> = {
  "reward_request.approve": "requestApprove",
  "reward_request.decline": "requestDecline",
  "reward_request.collect": "requestCollect",
};

/** Roster actions whose sentence names the person. */
const PERSON_SENTENCES: Record<string, string> = {
  "roster.person_create": "personCreate",
  "roster.person_update": "personUpdate",
  "roster.terminate": "terminate",
  "roster.reactivate": "reactivate",
};

/** Sign-in events: the person or owner it happened to, who is also who did it, or Crew Stars
 *  acting for them (a lockout, a reused session). */
const SIGN_IN_SENTENCES: Record<string, string> = {
  "auth.setup_complete": "setupComplete",
  "auth.password_reset": "passwordReset",
  // An owner who opened their emailed invite and chose a password (P7).
  "auth.invite_accept": "inviteAccept",
  "mfa.enable": "mfaEnable",
  "mfa.recovery_used": "mfaRecovery",
};
const SECURITY_SENTENCES: Record<string, string> = {
  "auth.lockout": "lockout",
  "auth.code_lockout": "codeLockout",
  "auth.refresh_reuse": "refreshReuse",
};

/** What happened, in one sentence. */
export function auditSentence(event: AuditEvent, book: AuditBook): Sentence {
  const actor = actorWord(event.actor);
  const after: Json = event.after ?? {};
  const details: Json = event.details ?? {};
  const action = event.action;

  if (action === "settings.update") {
    const sections = settingsSections(event);
    return sections.length
      ? sentence("settings", { actor, sections: { list: sections.map((key) => msg(`portal.nav.${key}`)) } })
      : sentence("settingsOther", { actor });
  }

  if (action === "reward.create") return sentence("rewardCreate", { actor, reward: targetWord(event, "reward") });
  if (action === "reward.delete") return sentence("rewardDelete", { actor, reward: targetWord(event, "reward") });
  if (action === "reward.update") {
    const reward = targetWord(event, "reward");
    // Hiding or showing it again is the edit owners make most (OP-11): said as what it is.
    const changed = Object.keys(after);
    if (changed.length === 1 && changed[0] === "active" && typeof after.active === "boolean") {
      return sentence(after.active ? "rewardShow" : "rewardHide", { actor, reward });
    }
    return sentence("rewardUpdate", { actor, reward });
  }

  const decision = DECISIONS[action];
  if (decision) {
    const name = str(details.reward) ?? str(event.target?.label);
    const reward: Word = name ? { text: name } : msg("audit.unknown.reward");
    // The requester's name, when the API sends one with the event.
    const person = str(details.person_name);
    return person
      ? sentence(`${decision}For`, { actor, reward, person: { text: person } })
      : sentence(decision, { actor, reward });
  }

  if (action === "shoutout.hide") {
    return details.store_id && typeof details.store_id === "string" && book.stores[details.store_id]
      ? sentence("shoutoutHideAt", { actor, store: storeWord(details.store_id, book) })
      : sentence("shoutoutHide", { actor });
  }
  if (action === "shoutout.owner_send") {
    const person = targetWord(event, "person");
    const coins = num(after.coins);
    if (coins === null) return sentence("ownerSendPlain", { actor, person });
    return sentence("ownerSend", { actor, person, coins, shown: { count: coins }, tag: tagWord(after.tag) });
  }

  const personSentence = PERSON_SENTENCES[action];
  if (personSentence) return sentence(personSentence, { actor, person: targetWord(event, "person") });
  if (action === "roster.store_create") return sentence("storeCreate", { actor, store: targetWord(event, "store") });
  if (action === "roster.store_update") return sentence("storeUpdate", { actor, store: targetWord(event, "store") });
  if (action === "roster.area_create") return sentence("areaCreate", { actor, area: targetWord(event, "area") });
  if (action === "roster.area_update") return sentence("areaUpdate", { actor, area: targetWord(event, "area") });
  if (action === "roster.import") return sentence("import", { actor });

  if (action === "awards.announce") {
    const label = str(event.target?.label);
    const number = str(details.store_number);
    const store: Word = label
      ? { text: label }
      : number
        ? msg("recognition.store", { number: { text: number } })
        : msg("audit.unknown.store");
    const month = str(after.month);
    return month
      ? sentence("announce", { actor, month: { month }, store })
      : sentence("announcePlain", { actor, store });
  }

  const signIn = SIGN_IN_SENTENCES[action];
  if (signIn) return sentence(signIn, { actor });
  const security = SECURITY_SENTENCES[action];
  if (security) return sentence(security, { person: targetWord(event, "person") });

  return sentence("other", { actor, action: { text: action } });
}

// -- values ----------------------------------------------------------------------------------

/** How a field's value is said. `auto` is for a field this file does not know. */
type ValueKind =
  | "auto"
  | "count"
  | "counts"
  | "usd"
  | "toggle"
  | "yesNo"
  | "text"
  | "role"
  | "scope"
  | "tag"
  | "prizeKind"
  | "personStatus"
  | "requestStatus"
  | "language"
  | "store"
  | "stores"
  | "area"
  | "zone"
  | "storeOpen"
  | "icon"
  | "unlockType"
  | "unlockId"
  | "badge"
  | "day";

interface FieldSpec {
  label: Word;
  kind: ValueKind;
}

const NOT_SET = msg("audit.values.notSet");

/** A stored value the way the page that sets it would say it. */
export function valueWord(kind: ValueKind, value: unknown, book: AuditBook): Word {
  // A reward with no unlock rule is open to anyone, whichever way the API wrote it.
  if (kind === "unlockType" && (value === null || value === undefined)) return msg("rewards.form.unlockTypes.none");
  if (kind === "zone" && (value === null || value === undefined || value === "")) return msg("roster.zones.default");
  if (value === null || value === undefined) return NOT_SET;
  switch (kind) {
    case "count":
      return typeof value === "number" ? { count: value } : autoWord(value);
    case "counts":
      return Array.isArray(value) ? { list: value.map((item) => valueWord("count", item, book)) } : autoWord(value);
    case "usd":
      return typeof value === "number" ? { usd: value } : autoWord(value);
    case "toggle":
      return typeof value === "boolean" ? msg(value ? "audit.values.on" : "audit.values.off") : autoWord(value);
    case "yesNo":
      return typeof value === "boolean" ? msg(value ? "audit.values.yes" : "audit.values.no") : autoWord(value);
    case "text":
      return typeof value === "string" ? (value === "" ? NOT_SET : { text: value }) : autoWord(value);
    case "role":
      return known(ROLES, value) ? msg(`roster.roles.${value}`) : autoWord(value);
    case "scope":
      return known(SCOPES, value) ? msg(`coins.scope.kinds.${value}`) : autoWord(value);
    case "tag":
      return tagWord(value);
    case "prizeKind":
      return known(PRIZE_KINDS, value) ? msg(`spin.prizes.kinds.${value}`) : autoWord(value);
    case "personStatus":
      return value === "active"
        ? msg("roster.people.active")
        : value === "terminated"
          ? msg("roster.people.terminatedBadge")
          : autoWord(value);
    case "requestStatus":
      return known(REQUEST_STATUSES, value) ? msg(`redemptions.requests.status.${value}`) : autoWord(value);
    case "language":
      return value === "en" || value === "es" ? msg(`common.languages.${value}`) : autoWord(value);
    case "store":
      return storeWord(value, book);
    case "stores":
      if (!Array.isArray(value)) return autoWord(value);
      return value.length ? { list: value.map((id) => storeWord(id, book)) } : NOT_SET;
    case "area": {
      const name = typeof value === "string" ? book.areas[value] : undefined;
      return name ? { text: name } : msg("audit.unknown.area");
    }
    case "zone": {
      const key = zoneKey(typeof value === "string" ? value : null);
      return key
        ? msg("roster.zones.named", { zone: msg(`roster.zones.${key}`), id: { text: String(value) } })
        : autoWord(value);
    }
    case "storeOpen":
      return typeof value === "boolean" ? msg(value ? "roster.stores.open" : "roster.stores.closed") : autoWord(value);
    case "icon":
      return known(ICONS, value) ? msg(`rewards.form.icons.${value}`) : autoWord(value);
    case "unlockType":
      return known(UNLOCKS, value) ? msg(`rewards.form.unlockTypes.${value}`) : autoWord(value);
    case "unlockId": {
      const id = typeof value === "string" ? value : "";
      const name = book.tiers[id] ?? book.badges[id]?.name;
      return name ? { text: name } : autoWord(value);
    }
    case "badge": {
      const name = typeof value === "string" ? book.badges[value]?.name : undefined;
      return name ? { text: name } : autoWord(value);
    }
    case "day":
      return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? { day: value } : autoWord(value);
    default:
      return autoWord(value);
  }
}

/** A value of a field this file does not know, said plainly. */
function autoWord(value: unknown): Word {
  if (value === null || value === undefined) return NOT_SET;
  if (typeof value === "number") return { count: value };
  if (typeof value === "boolean") return msg(value ? "audit.values.yes" : "audit.values.no");
  if (typeof value === "string") return value === "" ? NOT_SET : { text: value };
  if (Array.isArray(value) && value.every((item) => item === null || typeof item !== "object")) {
    return value.length ? { list: value.map(autoWord) } : NOT_SET;
  }
  const text = JSON.stringify(value);
  return { text: text.length > 160 ? `${text.slice(0, 159)}…` : text };
}

// -- settings fields -------------------------------------------------------------------------

const role = (value: string | undefined): Word =>
  known(COIN_ROLES, value) ? msg(`coins.roles.${value}`) : { text: String(value ?? "") };
const of = (name: Word, field: Word): Word => msg("audit.fields.of", { name, field });
const raw = (path: string): FieldSpec => ({ label: { text: path }, kind: "auto" });

/** A field path as the page that sets it labels it ("allowance.crew" is "Crew: monthly kudos
 *  allowance"), and how its value reads. A path this file does not know is shown as it is. */
export function settingsField(path: string, book: AuditBook): FieldSpec {
  const [root, a, b] = path.split(".");
  switch (root) {
    case "allowance":
      return a && b === undefined
        ? { label: msg("coins.allowance.allowanceLabel", { role: role(a) }), kind: "count" }
        : raw(path);
    case "amounts":
      if (a && b === undefined) return { label: msg("audit.fields.amounts", { role: role(a) }), kind: "counts" };
      if (a && b !== undefined && /^\d+$/.test(b)) {
        return { label: msg("coins.allowance.amountLabel", { role: role(a), n: Number(b) + 1 }), kind: "count" };
      }
      return raw(path);
    case "scope":
      return a ? { label: msg("coins.scope.label", { role: role(a) }), kind: "scope" } : raw(path);
    case "upward":
      return { label: msg("coins.scope.upward"), kind: "toggle" };
    case "coin_value":
      return { label: msg("coins.limits.coinValue"), kind: "usd" };
    case "redeem":
      return (
        {
          max_coins: { label: msg("coins.limits.maxCoins"), kind: "count" },
          max_rewards: { label: msg("coins.limits.maxRewards"), kind: "count" },
          store_budget: { label: msg("coins.limits.storeBudget"), kind: "count" },
          approval: { label: msg("coins.limits.approval"), kind: "toggle" },
        } satisfies Record<string, FieldSpec>
      )[a ?? ""] ?? raw(path);
    case "spin":
      if (a === "prizes" && b) return prizeField(path, b, path.split(".")[3], book);
      return (
        {
          enabled: { label: msg("spin.switch.heading"), kind: "toggle" },
          every_coins: { label: msg("spin.earn.everyCoins"), kind: "count" },
          on_badge: { label: msg("spin.earn.onBadge"), kind: "toggle" },
          on_milestone: { label: msg("spin.earn.onMilestone"), kind: "toggle" },
          max_per_month: { label: msg("spin.earn.maxPerMonth"), kind: "count" },
          prizes: { label: msg("spin.prizes.heading"), kind: "auto" },
        } satisfies Record<string, FieldSpec>
      )[a ?? ""] ?? raw(path);
    case "tiers": {
      const tier: Word = { text: book.tiers[a ?? ""] ?? a ?? "" };
      return b === "min" ? { label: msg("badges.tiers.label", { tier }), kind: "count" } : raw(path);
    }
    case "badges": {
      const defined = book.badges[a ?? ""];
      const badge: Word = defined ? { text: defined.name } : { text: a ?? "" };
      switch (b) {
        case "name":
          return { label: of(badge, msg("badges.badges.name")), kind: "text" };
        case "name_es":
          return { label: of(badge, msg("audit.fields.nameEs")), kind: "text" };
        case "count":
          return defined && ["tag", "given", "days"].includes(defined.rule)
            ? { label: msg(`badges.badges.rules.${defined.rule}.label`, { badge }), kind: "count" }
            : { label: of(badge, msg("audit.fields.count")), kind: "count" };
        case "tag":
          return { label: msg("badges.badges.rules.tag.tagLabel", { badge }), kind: "tag" };
        case "bonus":
          return { label: msg("badges.badges.bonusLabel", { badge }), kind: "count" };
        case "gives_spin":
          return { label: msg("badges.badges.spinLabel", { badge }), kind: "toggle" };
        default:
          return raw(path);
      }
    }
    case "awards": {
      const award: Word = { text: book.awards[a ?? ""] ?? a ?? "" };
      switch (b) {
        case "name":
          return { label: of(award, msg("awards.categories.name")), kind: "text" };
        case "name_es":
          return { label: of(award, msg("audit.fields.nameEs")), kind: "text" };
        case "coins":
          return { label: msg("awards.categories.coinsLabel", { award }), kind: "count" };
        case "active":
          return { label: msg("awards.categories.activeLabel", { award }), kind: "toggle" };
        default:
          return raw(path);
      }
    }
    default:
      return raw(path);
  }
}

const PRIZE_FIELDS: Record<string, FieldSpec> = {
  label: { label: msg("spin.prizes.label"), kind: "text" },
  label_es: { label: msg("audit.fields.labelEs"), kind: "text" },
  kind: { label: msg("spin.prizes.columns.type"), kind: "prizeKind" },
  amount: { label: msg("spin.prizes.columns.amount"), kind: "count" },
  weight: { label: msg("spin.prizes.columns.weight"), kind: "count" },
  badge_id: { label: msg("audit.fields.badge"), kind: "badge" },
};

/** One prize's field: "+10 coins: Chance weight". */
function prizeField(path: string, id: string, field: string | undefined, book: AuditBook, name?: string): FieldSpec {
  const spec = field ? PRIZE_FIELDS[field] : undefined;
  if (!spec) return raw(path);
  const prize: Word = name ? { text: name } : book.prizes[id] ? { text: book.prizes[id] } : msg("audit.unknown.prize");
  return { label: of(prize, spec.label), kind: spec.kind };
}

/** A prize in one line: "Coins 10 · chance weight 30". */
function prizeSummary(prize: Json): Word {
  const kind = valueWord("prizeKind", prize.kind, emptyBook("en"));
  const weight: Word = { count: num(prize.weight) ?? 0 };
  const amount = num(prize.amount);
  return (prize.kind === "coins" || prize.kind === "kudos") && amount !== null
    ? msg("audit.values.prizeAmount", { kind, amount: { count: amount }, weight })
    : msg("audit.values.prize", { kind, weight });
}

/** Adding or removing a prize saves the whole list (`spin.prizes`): said prize by prize. */
function prizeListChanges(before: unknown, after: unknown, book: AuditBook): ChangeRow[] {
  const list = (value: unknown): Json[] => (Array.isArray(value) ? value.filter(isRecord) : []);
  const was = new Map(list(before).map((prize) => [String(prize.id), prize]));
  const now = new Map(list(after).map((prize) => [String(prize.id), prize]));
  const label = (prize: Json) =>
    prizeName({ label: String(prize.label ?? prize.id ?? ""), label_es: str(prize.label_es) }, book.locale);
  const rows: ChangeRow[] = [];
  for (const [id, prize] of now) {
    const old = was.get(id);
    if (!old) {
      rows.push({ key: `spin.prizes.${id}`, field: msg("audit.fields.prizeAdded", { name: { text: label(prize) } }), before: null, after: prizeSummary(prize) });
      continue;
    }
    for (const field of Object.keys(PRIZE_FIELDS)) {
      if (same(old[field], prize[field])) continue;
      const spec = prizeField(`spin.prizes.${id}.${field}`, id, field, book, label(prize));
      rows.push({
        key: `spin.prizes.${id}.${field}`,
        field: spec.label,
        before: valueWord(spec.kind, old[field], book),
        after: valueWord(spec.kind, prize[field], book),
      });
    }
  }
  for (const [id, prize] of was) {
    if (now.has(id)) continue;
    rows.push({ key: `spin.prizes.${id}`, field: msg("audit.fields.prizeRemoved", { name: { text: label(prize) } }), before: prizeSummary(prize), after: null });
  }
  return rows;
}

// -- records (rewards, people, stores, areas) ------------------------------------------------

const REWARD_FIELDS: Record<string, FieldSpec | null> = {
  name: { label: msg("rewards.form.name"), kind: "text" },
  name_es: { label: msg("audit.fields.nameEs"), kind: "text" },
  description: { label: msg("rewards.form.description"), kind: "text" },
  description_es: { label: msg("audit.fields.descriptionEs"), kind: "text" },
  icon: { label: msg("rewards.form.icon"), kind: "icon" },
  cost: { label: msg("rewards.form.cost"), kind: "count" },
  unlock_type: { label: msg("rewards.form.unlock"), kind: "unlockType" },
  unlock_id: { label: msg("audit.fields.unlockId"), kind: "unlockId" },
  per_person_monthly: { label: msg("rewards.form.perMonth"), kind: "count" },
  active: { label: msg("rewards.form.active"), kind: "toggle" },
  is_cash: { label: msg("rewards.form.cash"), kind: "yesNo" },
  // Said by the sentence ("deleted the reward").
  deleted: null,
};

const PERSON_FIELDS: Record<string, FieldSpec | null> = {
  name: { label: msg("roster.person.name"), kind: "text" },
  eid: { label: msg("roster.person.eid"), kind: "text" },
  role: { label: msg("roster.person.role"), kind: "role" },
  store_id: { label: msg("roster.person.store"), kind: "store" },
  store_ids: { label: msg("roster.person.stores"), kind: "stores" },
  area_id: { label: msg("roster.person.area"), kind: "area" },
  phone: { label: msg("roster.person.phone"), kind: "text" },
  hire_date: { label: msg("roster.person.hireDate"), kind: "day" },
  language: { label: msg("roster.person.language"), kind: "language" },
  status: { label: msg("roster.people.columns.status"), kind: "personStatus" },
};

const STORE_FIELDS: Record<string, FieldSpec | null> = {
  number: { label: msg("roster.stores.number"), kind: "text" },
  name: { label: msg("roster.stores.name"), kind: "text" },
  area_id: { label: msg("roster.stores.area"), kind: "area" },
  tz: { label: msg("roster.zones.label"), kind: "zone" },
  active: { label: msg("roster.stores.columns.active"), kind: "storeOpen" },
};

const AREA_FIELDS: Record<string, FieldSpec | null> = {
  name: { label: msg("roster.areas.name"), kind: "text" },
  tz: { label: msg("roster.zones.label"), kind: "zone" },
};

const REQUEST_FIELDS: Record<string, FieldSpec | null> = {
  status: { label: msg("redemptions.requests.columns.status"), kind: "requestStatus" },
};

const OWNER_SEND_FIELDS: Record<string, FieldSpec | null> = {
  coins: { label: msg("redemptions.requests.columns.coins"), kind: "count" },
  tag: { label: msg("audit.fields.tag"), kind: "tag" },
  // The post itself is on the wall; its id says nothing to an owner.
  shoutout_id: null,
};

/** A stored value that says nothing in a list of what a new record was made with. */
const blank = (value: unknown) =>
  value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0);

/**
 * A record's change: for an edit, each field that differs; for a new record, what it was made
 * with (empty fields left out); for a deleted one, what it was. `null` in `fields` hides a
 * field; a field it does not name is shown under its own name.
 */
function recordChanges(
  before: Json | null,
  after: Json | null,
  fields: Record<string, FieldSpec | null>,
  book: AuditBook,
  mode: "edit" | "removed" = "edit",
): ChangeRow[] {
  const spec = (key: string): FieldSpec | null => (key in fields ? fields[key]! : raw(key));
  const rows: ChangeRow[] = [];
  if (mode === "removed" && before) {
    for (const [key, value] of Object.entries(before)) {
      const field = spec(key);
      if (field && !blank(value)) rows.push({ key, field: field.label, before: valueWord(field.kind, value, book), after: null });
    }
    return rows;
  }
  if (!before && after) {
    for (const [key, value] of Object.entries(after)) {
      const field = spec(key);
      if (field && !blank(value)) rows.push({ key, field: field.label, before: null, after: valueWord(field.kind, value, book) });
    }
    return rows;
  }
  const keys = [...new Set([...Object.keys(after ?? {}), ...Object.keys(before ?? {})])];
  for (const key of keys) {
    const field = spec(key);
    const was = before?.[key];
    const is = after?.[key];
    if (!field || same(was, is)) continue;
    rows.push({ key, field: field.label, before: valueWord(field.kind, was, book), after: valueWord(field.kind, is, book) });
  }
  return rows;
}

/** The monthly award winners an announcement paid (OP-20), one row per category. */
function winnerChanges(after: Json, book: AuditBook): ChangeRow[] {
  const winners = Array.isArray(after.winners) ? after.winners.filter(isRecord) : [];
  if (winners.length === 0) {
    return [{ key: "winners", field: msg("audit.fields.winners"), before: null, after: msg("audit.values.noWinners") }];
  }
  return winners.map((winner, index) => {
    const awardId = String(winner.award_id ?? "");
    const award: Word = book.awards[awardId] ? { text: book.awards[awardId] } : msg("audit.unknown.award");
    const coins = num(winner.coins) ?? 0;
    // The winner's name, when the API sends one with the event.
    const name = str(winner.person_name);
    return {
      key: `winner-${index}`,
      field: award,
      before: null,
      after: name
        ? msg("audit.values.winnerNamed", { name: { text: name }, coins, shown: { count: coins } })
        : msg("audit.values.winner", { coins, shown: { count: coins } }),
    };
  });
}

/** The values before and after, row by row, in the owner's terms. */
export function auditChanges(event: AuditEvent, book: AuditBook): ChangeRow[] {
  const before = event.before ?? null;
  const after = event.after ?? null;
  const action = event.action;
  if (!before && !after) return [];

  if (action === "settings.update") {
    const was = before ?? {};
    const is = after ?? {};
    const rows: ChangeRow[] = [];
    for (const path of [...new Set([...Object.keys(is), ...Object.keys(was)])]) {
      if (path === "spin.prizes" && (Array.isArray(is[path]) || Array.isArray(was[path]))) {
        rows.push(...prizeListChanges(was[path], is[path], book));
        continue;
      }
      const field = settingsField(path, book);
      rows.push({ key: path, field: field.label, before: valueWord(field.kind, was[path], book), after: valueWord(field.kind, is[path], book) });
    }
    return rows;
  }
  if (action === "reward.delete") return recordChanges(before, after, REWARD_FIELDS, book, "removed");
  if (action.startsWith("reward.")) return recordChanges(before, after, REWARD_FIELDS, book);
  if (action.startsWith("reward_request.")) return recordChanges(before, after, REQUEST_FIELDS, book);
  if (action in PERSON_SENTENCES) return recordChanges(before, after, PERSON_FIELDS, book);
  if (action.startsWith("roster.store_")) return recordChanges(before, after, STORE_FIELDS, book);
  if (action.startsWith("roster.area_")) return recordChanges(before, after, AREA_FIELDS, book);
  if (action === "shoutout.owner_send") return recordChanges(before, after, OWNER_SEND_FIELDS, book);
  if (action === "awards.announce" && after) return winnerChanges(after, book);
  return recordChanges(before, after, {}, book);
}

/** Every action this file says in its own words; their other details are left out on
 *  purpose (ids an owner cannot use). */
const KNOWN_ACTIONS = new Set([
  "settings.update",
  "reward.create",
  "reward.update",
  "reward.delete",
  ...Object.keys(DECISIONS),
  "shoutout.hide",
  "shoutout.owner_send",
  ...Object.keys(PERSON_SENTENCES),
  "roster.store_create",
  "roster.store_update",
  "roster.area_create",
  "roster.area_update",
  "roster.import",
  "awards.announce",
  ...Object.keys(SIGN_IN_SENTENCES),
  ...Object.keys(SECURITY_SENTENCES),
]);

// -- details ---------------------------------------------------------------------------------

/**
 * Anything else the action recorded that an owner can use: the coins and store of a request,
 * an import's counts, how long a lockout lasts, the reason given. For an action this file does
 * not know, every detail, under its own name.
 */
export function auditDetails(event: AuditEvent, book: AuditBook): DetailRow[] {
  const details: Json = event.details ?? {};
  const rows: DetailRow[] = [];
  const add = (key: string, field: string, value: Word | null) => {
    if (value) rows.push({ key, field: msg(field), value });
  };
  const count = (value: unknown): Word | null => (num(value) !== null ? { count: num(value)! } : null);
  const action = event.action;

  if (action.startsWith("reward_request.")) {
    add("cost", "redemptions.requests.columns.coins", count(details.cost));
    if (typeof details.store_id === "string") add("store", "redemptions.requests.columns.store", storeWord(details.store_id, book));
  } else if (action === "roster.terminate") {
    const cancelled = Array.isArray(details.cancelled_requests) ? details.cancelled_requests.length : 0;
    if (cancelled > 0) add("cancelled", "audit.fields.cancelledRequests", { count: cancelled });
  } else if (action === "roster.import") {
    add("created", "audit.fields.importCreated", count(details.created));
    add("updated", "audit.fields.importUpdated", count(details.updated));
    add("failed", "audit.fields.importFailed", count(details.failed));
  } else if (action === "shoutout.hide") {
    if (typeof details.store_id === "string" && !book.stores[details.store_id]) {
      // Named in the sentence when the store is known; otherwise said here.
      add("store", "redemptions.requests.columns.store", storeWord(details.store_id, book));
    }
  } else if (action === "auth.lockout" || action === "auth.code_lockout") {
    add("tries", "audit.fields.wrongTries", count(details.after));
    const minutes = num(details.minutes);
    if (minutes !== null) add("minutes", "audit.fields.lockedFor", msg("audit.values.minutes", { count: minutes }));
  } else if (action === "mfa.recovery_used") {
    add("remaining", "audit.fields.recoveryLeft", count(details.remaining));
  } else if (!KNOWN_ACTIONS.has(action)) {
    for (const [key, value] of Object.entries(details)) rows.push({ key, field: { text: key }, value: autoWord(value) });
  }

  const reason = str(event.reason);
  if (reason) rows.push({ key: "reason", field: msg("audit.fields.reason"), value: { text: reason } });
  return rows;
}

/** Whether the log knows this action by name (the rest are shown as the API wrote them). */
export function isKnownAction(action: string): boolean {
  return KNOWN_ACTIONS.has(action);
}

/** A change table only for edits; a new or a deleted record is one column of values. */
export function changeLayout(rows: readonly ChangeRow[]): "added" | "removed" | "changed" {
  if (rows.length > 0 && rows.every((row) => row.before === null)) return "added";
  if (rows.length > 0 && rows.every((row) => row.after === null)) return "removed";
  return "changed";
}
