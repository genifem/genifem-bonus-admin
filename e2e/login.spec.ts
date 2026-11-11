import { expect, test } from "@playwright/test";

import { expectNoAccessibilityViolations } from "./helpers";

/** P0 smoke test: the owner's sign-in page renders, and passes WCAG 2.2 AA. */

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
