import type { Schemas } from "@crewstars/api-client";
import { MESSAGES } from "@crewstars/i18n";
import { describe, expect, it } from "vitest";

import {
  actorWord,
  auditBook,
  auditChanges,
  auditDetails,
  auditSentence,
  changeLayout,
  emptyBook,
  isKnownAction,
  settingsSections,
  type AuditBook,
  type Word,
} from "./audit-format";

type AuditEvent = Schemas["AuditEventOut"];

const GRANT = { type: "owner", id: "6af58bb9c176266fac49d5a3", name: "Grant" } as const;
const MONICA = { type: "person", id: "6af58bb8c176266fac49d58f", name: "Monica Diaz" } as const;
const SYSTEM = { type: "system", id: null, name: null } as const;
const STORE = "6af58bb8c176266fac49d587";
const AREA = "6af58bb8c176266fac49d585";

/** An event as GET /portal/audit sends one (shapes taken from the local API). */
function event(partial: Partial<AuditEvent> & Pick<AuditEvent, "action">): AuditEvent {
  return {
    id: "6af5d136e0b562ba3eef561b",
    at: "2026-11-12T14:46:14.207Z",
    kind: null,
    actor: GRANT,
    target: null,
    before: null,
    after: null,
    reason: null,
    details: {},
    ...partial,
  };
}

const book: AuditBook = {
  ...emptyBook("en"),
  stores: { [STORE]: { number: "2741", name: "Main St" } },
  areas: { [AREA]: "North area" },
  tiers: { silver: "Silver" },
  badges: { guest: { name: "Guest Hero", rule: "tag" }, lucky: { name: "Lucky Star", rule: "spin" } },
  awards: { top: "Top Earner" },
  prizes: { p1: "+10 coins" },
};

const settings = (before: Record<string, unknown>, after: Record<string, unknown>) =>
  event({ action: "settings.update", kind: "settings", target: { type: "settings", id: null, label: null }, before, after });

describe("who did it", () => {
  it("is their name, Crew Stars for the system, or a generic word for someone removed", () => {
    expect(actorWord(GRANT)).toEqual({ text: "Grant" });
    expect(actorWord(SYSTEM)).toEqual({ msg: "audit.actor.system" });
    expect(actorWord({ type: "owner", id: GRANT.id, name: null })).toEqual({ msg: "audit.actor.owner" });
    expect(actorWord({ type: "person", id: MONICA.id, name: "  " })).toEqual({ msg: "audit.actor.person" });
  });
});

describe("the sentence", () => {
  it("names the page a setting is set on (Grant changed Coins & limits)", () => {
    expect(auditSentence(settings({ "allowance.crew": 31 }, { "allowance.crew": 30 }), book)).toEqual({
      key: "audit.sentences.settings",
      values: { actor: { text: "Grant" }, sections: { list: [{ msg: "portal.nav.coins" }] } },
    });
  });

  it("lists each page once, in the order changed", () => {
    const changed = settings(
      { "spin.enabled": false, "awards.top.coins": 100, "spin.max_per_month": 3 },
      { "spin.enabled": true, "awards.top.coins": 125, "spin.max_per_month": 2 },
    );
    expect(settingsSections(changed)).toEqual(["spin", "awards"]);
    expect(settingsSections(settings({ "tiers.silver.min": 300 }, { "badges.guest.count": 3 }))).toEqual(["badges"]);
  });

  it("falls back to 'the settings' for a setting no page owns", () => {
    expect(auditSentence(settings({ "brand.color": "red" }, { "brand.color": "blue" }), book).key).toBe(
      "audit.sentences.settingsOther",
    );
  });

  it("says who decided a request, and for whom when the API names them", () => {
    const approve = event({
      action: "reward_request.approve",
      actor: MONICA,
      target: { type: "reward_request", id: "6af5baf3e0b562ba3eef55f8", label: "Free drink" },
      before: { status: "pending" },
      after: { status: "approved" },
      details: { person_id: "6af58bb8c176266fac49d595", store_id: STORE, reward: "Free drink", cost: 40 },
    });
    expect(auditSentence(approve, book)).toEqual({
      key: "audit.sentences.requestApprove",
      values: { actor: { text: "Monica Diaz" }, reward: { text: "Free drink" } },
    });
    const named = { ...approve, details: { ...approve.details, person_name: "Maria Lopez" } };
    expect(auditSentence(named, book)).toEqual({
      key: "audit.sentences.requestApproveFor",
      values: { actor: { text: "Monica Diaz" }, reward: { text: "Free drink" }, person: { text: "Maria Lopez" } },
    });
    expect(auditSentence({ ...approve, action: "reward_request.collect" }, book).key).toBe(
      "audit.sentences.requestCollect",
    );
  });

  it("says hiding or showing a reward as that, and any other edit as an edit", () => {
    const reward = { type: "reward", id: "6af5a0000000000000000001", label: "Free meal" };
    const hide = event({ action: "reward.update", target: reward, before: { active: true }, after: { active: false } });
    expect(auditSentence(hide, book).key).toBe("audit.sentences.rewardHide");
    expect(auditSentence({ ...hide, before: { active: false }, after: { active: true } }, book).key).toBe(
      "audit.sentences.rewardShow",
    );
    expect(auditSentence({ ...hide, before: { cost: 40 }, after: { cost: 50 } }, book)).toEqual({
      key: "audit.sentences.rewardUpdate",
      values: { actor: { text: "Grant" }, reward: { text: "Free meal" } },
    });
  });

  it("names the person a roster change was about (Grant terminated Maria Lopez)", () => {
    const terminate = event({
      action: "roster.terminate",
      target: { type: "person", id: "6af58e46b918adf0fafcb684", label: "Maria Lopez" },
      before: { status: "active" },
      after: { status: "terminated" },
    });
    expect(auditSentence(terminate, book)).toEqual({
      key: "audit.sentences.terminate",
      values: { actor: { text: "Grant" }, person: { text: "Maria Lopez" } },
    });
    expect(auditSentence({ ...terminate, target: { ...terminate.target!, label: null } }, book).values.person).toEqual({
      msg: "audit.unknown.person",
    });
  });

  it("says an owner's shout-out with its coins and tag", () => {
    const send = event({
      action: "shoutout.owner_send",
      target: { type: "person", id: "6af58bb8c176266fac49d595", label: "Ana Ruiz" },
      after: { coins: 150, tag: "lead", shoutout_id: "6af5c0000000000000000001" },
    });
    expect(auditSentence(send, book)).toEqual({
      key: "audit.sentences.ownerSend",
      values: {
        actor: { text: "Grant" },
        person: { text: "Ana Ruiz" },
        coins: 150,
        shown: { count: 150 },
        tag: { msg: "recognition.tags.lead" },
      },
    });
  });

  it("puts the person first for something done to them (a lockout)", () => {
    const lockout = event({
      action: "auth.lockout",
      actor: SYSTEM,
      target: { type: "person", id: MONICA.id, label: "Monica Diaz" },
      details: { after: 5, minutes: 15 },
    });
    expect(auditSentence(lockout, book)).toEqual({
      key: "audit.sentences.lockout",
      values: { person: { text: "Monica Diaz" } },
    });
  });

  it("names the month and store of an announcement", () => {
    const announce = event({
      action: "awards.announce",
      target: { type: "store", id: STORE, label: "2741 · Main St" },
      after: { month: "2026-11", winners: [] },
      details: { store_number: "2741" },
    });
    expect(auditSentence(announce, book).values).toEqual({
      actor: { text: "Grant" },
      month: { month: "2026-11" },
      store: { text: "2741 · Main St" },
    });
  });

  it("still shows an action it does not know, as the API wrote it", () => {
    const novel = event({ action: "payroll.export", details: { month: "2026-10" } });
    expect(isKnownAction("payroll.export")).toBe(false);
    expect(auditSentence(novel, book)).toEqual({
      key: "audit.sentences.other",
      values: { actor: { text: "Grant" }, action: { text: "payroll.export" } },
    });
    expect(auditDetails(novel, book)).toEqual([{ key: "month", field: { text: "month" }, value: { text: "2026-10" } }]);
  });
});

describe("before and after: settings", () => {
  it("labels a field as its page does", () => {
    expect(auditChanges(settings({ "allowance.crew": 31 }, { "allowance.crew": 30 }), book)).toEqual([
      {
        key: "allowance.crew",
        field: { msg: "coins.allowance.allowanceLabel", values: { role: { msg: "coins.roles.crew" } } },
        before: { count: 31 },
        after: { count: 30 },
      },
    ]);
    const [size] = auditChanges(settings({ "amounts.gm.1": 25 }, { "amounts.gm.1": 30 }), book);
    expect(size!.field).toEqual({
      msg: "coins.allowance.amountLabel",
      values: { role: { msg: "coins.roles.gm" }, n: 2 },
    });
  });

  it("says values in the owner's words: on/off, scopes, dollars, tags", () => {
    const rows = auditChanges(
      settings(
        { "redeem.approval": true, "scope.gm": "store", coin_value: 0.1, "badges.guest.tag": "team" },
        { "redeem.approval": false, "scope.gm": "area", coin_value: 0.12, "badges.guest.tag": "guest" },
      ),
      book,
    );
    expect(rows.map((row) => [row.before, row.after])).toEqual([
      [{ msg: "audit.values.on" }, { msg: "audit.values.off" }],
      [{ msg: "coins.scope.kinds.store" }, { msg: "coins.scope.kinds.area" }],
      [{ usd: 0.1 }, { usd: 0.12 }],
      [{ msg: "recognition.tags.team" }, { msg: "recognition.tags.guest" }],
    ]);
    expect(rows[3]!.field).toEqual({ msg: "badges.badges.rules.tag.tagLabel", values: { badge: { text: "Guest Hero" } } });
  });

  it("names tiers, badges and awards from the settings, and a cleared value as not set", () => {
    const rows = auditChanges(
      settings(
        { "tiers.silver.min": 300, "badges.guest.count": 4, "badges.guest.name_es": null, "awards.top.active": true },
        { "tiers.silver.min": 250, "badges.guest.count": 3, "badges.guest.name_es": "Héroe del cliente", "awards.top.active": false },
      ),
      book,
    );
    expect(rows.map((row) => row.field)).toEqual([
      { msg: "badges.tiers.label", values: { tier: { text: "Silver" } } },
      { msg: "badges.badges.rules.tag.label", values: { badge: { text: "Guest Hero" } } },
      { msg: "audit.fields.of", values: { name: { text: "Guest Hero" }, field: { msg: "audit.fields.nameEs" } } },
      { msg: "awards.categories.activeLabel", values: { award: { text: "Top Earner" } } },
    ]);
    expect(rows[2]!.before).toEqual({ msg: "audit.values.notSet" });
    expect(rows[2]!.after).toEqual({ text: "Héroe del cliente" });
  });

  it("says a prize list saved whole as the prizes added, removed and changed", () => {
    const p1 = { id: "p1", label: "+10 coins", label_es: "+10 monedas", kind: "coins", amount: 10, weight: 30, badge_id: null };
    const p3 = { id: "p3", label: "Free drink", label_es: null, kind: "item", amount: 0, weight: 15, badge_id: null };
    const p9 = { id: "p9", label: "Lucky", label_es: null, kind: "badge", amount: 0, weight: 5, badge_id: "lucky" };
    const rows = auditChanges(settings({ "spin.prizes": [p1, p3] }, { "spin.prizes": [{ ...p1, weight: 25 }, p9] }), book);
    expect(rows).toEqual([
      {
        key: "spin.prizes.p1.weight",
        field: { msg: "audit.fields.of", values: { name: { text: "+10 coins" }, field: { msg: "spin.prizes.columns.weight" } } },
        before: { count: 30 },
        after: { count: 25 },
      },
      {
        key: "spin.prizes.p9",
        field: { msg: "audit.fields.prizeAdded", values: { name: { text: "Lucky" } } },
        before: null,
        after: { msg: "audit.values.prize", values: { kind: { msg: "spin.prizes.kinds.badge" }, weight: { count: 5 } } },
      },
      {
        key: "spin.prizes.p3",
        field: { msg: "audit.fields.prizeRemoved", values: { name: { text: "Free drink" } } },
        before: { msg: "audit.values.prize", values: { kind: { msg: "spin.prizes.kinds.item" }, weight: { count: 15 } } },
        after: null,
      },
    ]);
  });

  it("labels one prize's field by the prize, and its badge by name", () => {
    const [kind, badge] = auditChanges(
      settings(
        { "spin.prizes.p1.kind": "coins", "spin.prizes.p1.badge_id": null },
        { "spin.prizes.p1.kind": "badge", "spin.prizes.p1.badge_id": "lucky" },
      ),
      book,
    );
    expect(kind!.after).toEqual({ msg: "spin.prizes.kinds.badge" });
    expect(badge!.field).toEqual({
      msg: "audit.fields.of",
      values: { name: { text: "+10 coins" }, field: { msg: "audit.fields.badge" } },
    });
    expect(badge!.after).toEqual({ text: "Lucky Star" });
  });

  it("shows a path it does not know as the path", () => {
    expect(auditChanges(settings({ "brand.color": "red" }, { "brand.color": "blue" }), book)).toEqual([
      { key: "brand.color", field: { text: "brand.color" }, before: { text: "red" }, after: { text: "blue" } },
    ]);
  });
});

describe("before and after: records", () => {
  const view = {
    eid: "2741007",
    name: "Rosa Vega",
    role: "crew",
    store_id: STORE,
    store_ids: [],
    area_id: AREA,
    hire_date: null,
    status: "active",
    language: "en",
    phone: "(•••) •••-0150",
  };

  it("lists what a new person was added with, leaving out empty fields", () => {
    const rows = auditChanges(event({ action: "roster.person_create", after: view }), book);
    expect(rows.map((row) => row.key)).toEqual(["eid", "name", "role", "store_id", "area_id", "status", "language", "phone"]);
    expect(changeLayout(rows)).toBe("added");
    expect(rows.find((row) => row.key === "store_id")!.after).toEqual({
      msg: "recognition.storeFilter.option",
      values: { number: { text: "2741" }, name: { text: "Main St" } },
    });
    expect(rows.find((row) => row.key === "language")!.after).toEqual({ msg: "common.languages.en" });
  });

  it("shows only the fields an edit changed", () => {
    const rows = auditChanges(
      event({ action: "roster.person_update", before: view, after: { ...view, role: "shift", hire_date: "2025-03-01" } }),
      book,
    );
    expect(rows).toEqual([
      { key: "role", field: { msg: "roster.person.role" }, before: { msg: "roster.roles.crew" }, after: { msg: "roster.roles.shift" } },
      { key: "hire_date", field: { msg: "roster.person.hireDate" }, before: { msg: "audit.values.notSet" }, after: { day: "2025-03-01" } },
    ]);
    expect(changeLayout(rows)).toBe("changed");
  });

  it("shows what a deleted reward was, without the deleted flag", () => {
    const reward = { name: "Free meal", name_es: null, description: "", description_es: null, icon: "burger", cost: 300, unlock_type: "tier", unlock_id: "silver", per_person_monthly: 1, active: true, is_cash: false };
    const rows = auditChanges(
      event({ action: "reward.delete", before: reward, after: { ...reward, active: false, deleted: true } }),
      book,
    );
    expect(changeLayout(rows)).toBe("removed");
    expect(rows.map((row) => row.key)).toEqual(["name", "icon", "cost", "unlock_type", "unlock_id", "per_person_monthly", "active", "is_cash"]);
    expect(rows.find((row) => row.key === "unlock_id")!.before).toEqual({ text: "Silver" });
    expect(rows.find((row) => row.key === "icon")!.before).toEqual({ msg: "rewards.form.icons.burger" });
  });

  it("says a store's time zone and whether it is open", () => {
    const [tz, open] = auditChanges(
      event({
        action: "roster.store_update",
        before: { number: "2741", name: "Main St", area_id: AREA, tz: null, active: true },
        after: { number: "2741", name: "Main St", area_id: AREA, tz: "America/Chicago", active: false },
      }),
      book,
    );
    expect(tz!.before).toEqual({ msg: "roster.zones.default" });
    expect(tz!.after).toEqual({
      msg: "roster.zones.named",
      values: { zone: { msg: "roster.zones.central" }, id: { text: "America/Chicago" } },
    });
    expect(open!.after).toEqual({ msg: "roster.stores.closed" });
  });

  it("lists an announcement's winners by award", () => {
    const rows = auditChanges(
      event({
        action: "awards.announce",
        after: { month: "2026-11", winners: [{ award_id: "top", person_id: MONICA.id, coins: 100, value: 820 }] },
      }),
      book,
    );
    expect(rows).toEqual([
      { key: "winner-0", field: { text: "Top Earner" }, before: null, after: { msg: "audit.values.winner", values: { coins: 100, shown: { count: 100 } } } },
    ]);
  });
});

describe("details", () => {
  it("gives a request's coins and store", () => {
    const rows = auditDetails(
      event({ action: "reward_request.decline", details: { person_id: "x", store_id: STORE, reward: "Free drink", cost: 40 } }),
      book,
    );
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["cost", { count: 40 }],
      ["store", { msg: "recognition.storeFilter.option", values: { number: { text: "2741" }, name: { text: "Main St" } } }],
    ]);
  });

  it("gives an import's counts", () => {
    const rows = auditDetails(event({ action: "roster.import", details: { created: 12, updated: 3, failed: 1 } }), book);
    expect(rows.map((row) => [row.field, row.value])).toEqual([
      [{ msg: "audit.fields.importCreated" }, { count: 12 }],
      [{ msg: "audit.fields.importUpdated" }, { count: 3 }],
      [{ msg: "audit.fields.importFailed" }, { count: 1 }],
    ]);
  });

  it("gives a lockout's length, and the reason when one was given", () => {
    const rows = auditDetails(
      event({ action: "auth.lockout", actor: SYSTEM, details: { after: 5, minutes: 15 }, reason: "too many tries" }),
      book,
    );
    expect(rows.map((row) => row.value)).toEqual([
      { count: 5 },
      { msg: "audit.values.minutes", values: { count: 15 } },
      { text: "too many tries" },
    ]);
  });

  it("leaves out ids an owner cannot use", () => {
    expect(auditDetails(event({ action: "shoutout.hide", details: { store_id: STORE } }), book)).toEqual([]);
  });
});

describe("the book", () => {
  it("names things in the owner's language", () => {
    const rules = {
      tiers: [{ id: "gold", name: "Gold", name_es: "Oro", min: 600, color: "#F5B700" }],
      badges: [{ id: "guest", name: "Guest Hero", name_es: null, rule: "tag", tag: "guest", count: 3, bonus: 25, gives_spin: false, icon: "heart" }],
      awards: [{ id: "top", name: "Top Earner", name_es: "Más monedas", metric: "earned", coins: 100, active: true }],
      spin: { enabled: true, every_coins: 100, max_per_month: 3, on_badge: true, on_milestone: true, prizes_version: 1, prizes: [{ id: "p1", label: "+10 coins", label_es: "+10 monedas", kind: "coins", amount: 10, weight: 30, badge_id: null }] },
    } satisfies Pick<Schemas["Rules"], "tiers" | "badges" | "awards" | "spin">;
    const es = auditBook({ stores: [{ id: STORE, number: "2741", name: "Main St" }], areas: null, rules }, "es");
    expect(es.tiers).toEqual({ gold: "Oro" });
    expect(es.badges).toEqual({ guest: { name: "Guest Hero", rule: "tag" } });
    expect(es.awards).toEqual({ top: "Más monedas" });
    expect(es.prizes).toEqual({ p1: "+10 monedas" });
    expect(es.stores[STORE]).toEqual({ number: "2741", name: "Main St" });
    expect(auditBook({}, "en")).toEqual(emptyBook("en"));
  });
});

// -- every key this file can say is in both catalogs, with the values its message needs ------

type Catalog = Record<string, unknown>;

function message(catalog: Catalog, key: string): string | undefined {
  const found = key.split(".").reduce<unknown>((node, part) => (node as Catalog | undefined)?.[part], catalog);
  return typeof found === "string" ? found : undefined;
}

const placeholders = (text: string) => [...text.matchAll(/\{\s*(\w+)\s*[},]/g)].map((match) => match[1]!);

function* words(word: Word | number | null): Generator<{ msg: string; values?: Record<string, Word | number> }> {
  if (word === null || typeof word === "number") return;
  if ("msg" in word) {
    yield word;
    for (const value of Object.values(word.values ?? {})) yield* words(value);
  } else if ("list" in word) {
    for (const item of word.list) yield* words(item);
  }
}

describe("the catalogs", () => {
  const corpus: AuditEvent[] = [
    settings(
      { "allowance.owner": 500, "amounts.crew": [10, 25, 50], "upward": false, "redeem.max_coins": 900, "redeem.max_rewards": 3, "redeem.store_budget": 8000, "spin.every_coins": 100, "spin.on_badge": true, "spin.on_milestone": true, "badges.guest.name": "Guest", "badges.guest.bonus": 10, "badges.guest.gives_spin": false, "badges.lucky.count": 1, "awards.top.name": "Top", "awards.top.name_es": null, "awards.top.coins": 100, "spin.prizes.p1.label": "+10", "spin.prizes.p1.label_es": null, "spin.prizes.p1.amount": 10, "spin.prizes.zz.weight": 1 },
      { "allowance.owner": 600, "amounts.crew": [10, 25, 75], "upward": true, "redeem.max_coins": 800, "redeem.max_rewards": 4, "redeem.store_budget": 9000, "spin.every_coins": 0, "spin.on_badge": false, "spin.on_milestone": false, "badges.guest.name": "Guest Hero", "badges.guest.bonus": 25, "badges.guest.gives_spin": true, "badges.lucky.count": 2, "awards.top.name": "Top Earner", "awards.top.name_es": "Más monedas", "awards.top.coins": 125, "spin.prizes.p1.label": "+10 coins", "spin.prizes.p1.label_es": "+10 monedas", "spin.prizes.p1.amount": 15, "spin.prizes.zz.weight": 2 },
    ),
    settings({ "spin.prizes": [{ id: "a", label: "A", kind: "kudos", amount: 5, weight: 1 }] }, { "spin.prizes": [] }),
    settings({ x: 1 }, { x: 2 }),
    event({ action: "reward.create", target: { type: "reward", id: null, label: null }, after: { name: "Shirt", name_es: "Camiseta", description: "A shirt", description_es: "Una camiseta", icon: "shirt", cost: 500, unlock_type: "badge", unlock_id: "guest", per_person_monthly: 1, active: true, is_cash: true } }),
    event({ action: "reward.update", before: { unlock_type: "none" }, after: { unlock_type: null } }),
    event({ action: "reward.update", before: { active: true }, after: { active: false } }),
    event({ action: "reward.update", before: { active: false }, after: { active: true } }),
    event({ action: "reward.delete", before: { name: "Shirt", active: true }, after: { name: "Shirt", active: false, deleted: true } }),
    ...(["approve", "decline", "collect"] as const).flatMap((decision) => [
      event({ action: `reward_request.${decision}`, before: { status: "pending" }, after: { status: decision === "collect" ? "collected" : `${decision}d` }, details: { cost: 40, store_id: "nope" } }),
      event({ action: `reward_request.${decision}`, details: { person_name: "Maria", reward: "Free drink" } }),
    ]),
    event({ action: "shoutout.hide", details: { store_id: STORE } }),
    event({ action: "shoutout.hide", details: { store_id: "gone" } }),
    event({ action: "shoutout.owner_send", after: { coins: 5, tag: "rush" } }),
    event({ action: "shoutout.owner_send", after: { tag: "rush" } }),
    event({ action: "roster.person_create", after: { name: "A", role: "director", store_ids: [STORE, "gone"], area_id: "gone", status: "terminated", language: "es", hire_date: "2024-01-02" } }),
    event({ action: "roster.person_update", before: { role: "gm" }, after: { role: "supervisor" } }),
    event({ action: "roster.terminate", before: { status: "active" }, after: { status: "terminated" }, details: { cancelled_requests: ["a"] } }),
    event({ action: "roster.reactivate", before: { status: "terminated" }, after: { status: "active" } }),
    event({ action: "roster.store_create", after: { number: "1", name: "B", area_id: AREA, tz: "Somewhere/Else", active: true } }),
    event({ action: "roster.store_update", before: { active: false }, after: { active: true } }),
    event({ action: "roster.area_create", after: { name: "West", tz: "Pacific/Honolulu" } }),
    event({ action: "roster.area_update", before: { name: "W" }, after: { name: "West" } }),
    event({ action: "roster.import", details: { created: 1, updated: 0, failed: 2 } }),
    event({ action: "awards.announce", after: { month: "2026-11", winners: [{ award_id: "gone", coins: 5, person_name: "Ana" }] }, details: { store_number: "2741" } }),
    event({ action: "awards.announce", after: { winners: [] } }),
    event({ action: "awards.announce", after: { winners: [] }, actor: { type: "owner", id: null, name: null } }),
    event({ action: "auth.lockout", actor: SYSTEM, details: { after: 5, minutes: 15 } }),
    event({ action: "auth.code_lockout", actor: SYSTEM }),
    event({ action: "auth.refresh_reuse", actor: SYSTEM }),
    event({ action: "auth.setup_complete", actor: MONICA }),
    event({ action: "auth.password_reset", actor: { type: "person", id: null, name: null } }),
    event({ action: "mfa.enable" }),
    event({ action: "mfa.recovery_used", details: { remaining: 9 }, reason: "lost phone" }),
    event({ action: "something.new", before: { a: [1, 2] }, after: { a: { b: true } } }),
  ];

  it.each(["en", "es"] as const)("%s has every key the log can say, with its values", (locale) => {
    const catalog = MESSAGES[locale] as unknown as Catalog;
    const said = corpus.flatMap((item) => {
      const sentence = auditSentence(item, book);
      return [
        { msg: sentence.key, values: sentence.values },
        ...Object.values(sentence.values).flatMap((value) => [...words(value)]),
        ...auditChanges(item, book).flatMap((row) => [...words(row.field), ...words(row.before), ...words(row.after)]),
        ...auditDetails(item, book).flatMap((row) => [...words(row.field), ...words(row.value)]),
      ];
    });
    expect(said.length).toBeGreaterThan(100);
    for (const word of said) {
      const text = message(catalog, word.msg);
      expect(text, word.msg).toBeTypeOf("string");
      for (const name of placeholders(text!)) expect(Object.keys(word.values ?? {}), `${word.msg} {${name}}`).toContain(name);
    }
  });
});
