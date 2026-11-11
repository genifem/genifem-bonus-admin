import { expect, test, type Page } from "@playwright/test";

import { expectNoAccessibilityViolations, signIn } from "./helpers";

/**
 * P1 Roster (plan G1, D20) against the seeded e2e operator: the prototype's 4 stores, 2 areas
 * and 24 people. Every person a test adds gets an Employee ID of its own, so the suite can run
 * again on the same database.
 */

function freshEid(project: string): string {
  return `E2E${Date.now().toString().slice(-9)}${project === "phone" ? "P" : "D"}`;
}

/** A person's name cell: the row's buttons also carry the name, for a screen reader. */
const nameCell = (scope: ReturnType<Page["getByRole"]>, name: string) =>
  scope.getByRole("cell", { name, exact: true });

async function pickOption(page: Page, scope: ReturnType<Page["getByRole"]>, label: string, option: string) {
  await scope.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

test("the roster shows people, stores and areas, keeps its filters in the URL and is accessible", async ({
  page,
}) => {
  await signIn(page, "/roster");
  await expect(page.getByRole("heading", { level: 1, name: "Roster" })).toBeVisible();
  const people = page.getByRole("region", { name: "People on the roster" });
  await expect(nameCell(people, "Maria Lopez")).toBeVisible();
  await expectNoAccessibilityViolations(page, "/roster");

  // The store filter is the store's number in the URL (OP-01).
  await page.goto("/roster?store=2815");
  await expect(nameCell(people, "Kayla Nguyen")).toBeVisible();
  await expect(nameCell(people, "Maria Lopez")).toHaveCount(0);

  // Searching is a GET form: the search lands in the URL beside the store it searches in.
  await page.getByLabel("Search").fill("Tyrone");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/q=Tyrone/);
  await expect(page).toHaveURL(/store=2815/);
  await expect(nameCell(people, "Tyrone James")).toBeVisible();
  await expect(nameCell(people, "Kayla Nguyen")).toHaveCount(0);

  await page.getByRole("link", { name: "Stores", exact: true }).click();
  const stores = page.getByRole("region", { name: "Stores" });
  await expect(stores.getByRole("row", { name: /2741/ })).toContainText("Monica Diaz");
  await expectNoAccessibilityViolations(page, "/roster?tab=stores");

  await page.getByRole("link", { name: "Areas", exact: true }).click();
  const areas = page.getByRole("region", { name: "Areas" });
  await expect(areas.getByRole("row", { name: /North area/ })).toContainText("Rachel Kim");
  await expectNoAccessibilityViolations(page, "/roster?tab=areas");
});

test("an owner adds someone, edits them, terminates them and reactivates them", async ({ page }, testInfo) => {
  const eid = freshEid(testInfo.project.name);
  await signIn(page, "/roster");

  await page.getByRole("button", { name: "Add person" }).click();
  const add = page.getByRole("dialog", { name: "Add a person" });
  await add.getByLabel("Full name").fill(`Test ${eid}`);
  await add.getByLabel("Employee ID").fill(eid);
  await pickOption(page, add, "Store", "2741 · Main St");
  await expectNoAccessibilityViolations(page, "/roster (add person)");
  await add.getByRole("button", { name: "Add person" }).click();
  await expect(add).toBeHidden();

  // The same Employee ID again is refused next to the field.
  await page.getByRole("button", { name: "Add person" }).click();
  const again = page.getByRole("dialog", { name: "Add a person" });
  await again.getByLabel("Full name").fill("Someone Else");
  await again.getByLabel("Employee ID").fill(eid);
  await pickOption(page, again, "Store", "2741 · Main St");
  await again.getByRole("button", { name: "Add person" }).click();
  await expect(again.getByText("Someone on the roster already has that Employee ID.")).toBeVisible();
  await again.getByRole("button", { name: "Cancel" }).click();
  await expect(again).toBeHidden();

  await page.goto(`/roster?q=${eid}`);
  const row = page.getByRole("row", { name: new RegExp(eid) });
  await expect(row).toContainText(`Test ${eid}`);

  await row.getByRole("button", { name: /^Edit/ }).click();
  const edit = page.getByRole("dialog", { name: `Edit Test ${eid}` });
  await edit.getByLabel("Full name").fill(`Renamed ${eid}`);
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(edit).toBeHidden();
  await expect(row).toContainText(`Renamed ${eid}`);

  // CR-09: terminating says what it does before it does it.
  await row.getByRole("button", { name: /^Terminate/ }).click();
  const terminate = page.getByRole("alertdialog", { name: `Terminate Renamed ${eid}?` });
  await expect(terminate).toContainText("won't be able to sign in");
  await terminate.getByRole("button", { name: "Terminate" }).click();
  await expect(page.getByRole("row", { name: new RegExp(eid) })).toHaveCount(0);

  await page.goto(`/roster?q=${eid}&status=terminated`);
  await expect(row).toContainText("Terminated");
  await row.getByRole("button", { name: /^Reactivate/ }).click();
  await page.getByRole("alertdialog", { name: `Reactivate Renamed ${eid}?` }).getByRole("button", { name: "Reactivate" }).click();
  await expect(page.getByRole("row", { name: new RegExp(eid) })).toHaveCount(0);
});

test("a CSV is checked line by line before anything is imported", async ({ page }, testInfo) => {
  const eid = freshEid(testInfo.project.name);
  await signIn(page, "/roster?tab=import");

  const csv = `eid,name,role,store\n${eid},CSV ${eid},crew,2741\nX!,No Store,crew,9999\n`;
  await page.getByLabel("CSV file").setInputFiles({
    name: "roster.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(csv),
  });
  await page.getByRole("button", { name: "Check the file" }).click();
  await expect(page.getByText("2 lines read: 1 to add, 0 to update, 1 with problems.")).toBeVisible();
  const lines = page.getByRole("region", { name: "Lines in the file" });
  await expect(lines.getByRole("row", { name: /X!/ })).toContainText("Skip");
  await expectNoAccessibilityViolations(page, "/roster?tab=import (preview)");

  await page.getByRole("button", { name: "Import 1 person" }).click();
  await expect(page.getByText("Import finished: 1 added, 0 updated, 1 skipped.")).toBeVisible();

  await page.goto(`/roster?q=${eid}`);
  await expect(page.getByRole("row", { name: new RegExp(eid) })).toContainText(`CSV ${eid}`);
});
