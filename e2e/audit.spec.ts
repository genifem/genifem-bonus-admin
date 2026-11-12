import { expect, test } from "@playwright/test";

import { expectNoAccessibilityViolations, signIn } from "./helpers";

/**
 * P5 Audit log (NF-09) against the seeded e2e operator. What is in the log depends on what the
 * other tests did first, so these check the page's frame, its filters and the way in from a
 * person's row - not particular entries.
 */

test("the audit log filters by kind of change, in the URL", async ({ page }) => {
  await signIn(page, "/audit");
  await expect(page.getByRole("heading", { level: 1, name: "Audit log" })).toBeVisible();
  const kinds = page.getByRole("navigation", { name: "Filter by kind of change" });
  await expect(kinds.getByRole("link", { name: "Everything" })).toHaveAttribute("aria-current", "page");
  await expectNoAccessibilityViolations(page, "/audit");

  await kinds.getByRole("link", { name: "Roster" }).click();
  await page.waitForURL((url) => url.searchParams.get("kind") === "roster");
  await expect(kinds.getByRole("link", { name: "Roster" })).toHaveAttribute("aria-current", "page");
});

test("a person's row on Roster opens their history", async ({ page }) => {
  await signIn(page, "/roster");
  const people = page.getByRole("region", { name: "People on the roster" });
  await people.getByRole("link", { name: /^History/ }).first().click();
  await page.waitForURL((url) => url.pathname === "/audit" && url.searchParams.has("target"));
  await expect(page.getByRole("link", { name: "Show everyone's changes" })).toBeVisible();
  await expectNoAccessibilityViolations(page, "/audit?target= (one person's history)");

  await page.getByRole("link", { name: "Show everyone's changes" }).click();
  await page.waitForURL((url) => url.pathname === "/audit" && !url.searchParams.has("target"));
});
