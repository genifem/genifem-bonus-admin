import { expect, test } from "@playwright/test";

import { expectNoAccessibilityViolations, signIn } from "./helpers";

/** The owner's sign-in page: it renders, passes WCAG 2.2 AA, and lets the seeded owner in. */

test("a signed-out visit to the portal lands on sign-in", async ({ page }) => {
  await page.goto("/coins");
  await expect(page).toHaveURL(/\/login\?next=%2Fcoins$/);
});

test("the sign-in page renders and is accessible", async ({ page }) => {
  await page.goto("/login");

  await expect(page.getByRole("heading", { level: 1, name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("type", "password");

  // The show/hide toggle reveals the password and says so.
  const toggle = page.getByRole("button", { name: "Show password" });
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(password).toHaveAttribute("type", "text");
  await toggle.click();
  await expect(password).toHaveAttribute("type", "password");

  await expect(page.getByRole("button", { name: "Sign in" })).toBeEnabled();
  await expectNoAccessibilityViolations(page, "/login");
});

test("a refused sign-in never says which half was wrong", async ({ page }) => {
  await page.goto("/login");
  // An address with no account: a wrong password for a real one would count towards a lockout.
  await page.getByLabel("Email").fill("nobody@example.com");
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toHaveText("That email and password don't match.");
});

test("the seeded owner signs in and sees their name in the rail (OP-21)", async ({ page }) => {
  await signIn(page, "/roster");
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
  // The rail's account card is drawn from 860px; a phone shows the way out beside the lockup.
  const signedInAs = page.getByRole("region", { name: "Signed in as" });
  if (await signedInAs.isVisible()) await expect(signedInAs).toContainText("Grant");
});
