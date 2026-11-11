import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

/**
 * WCAG 2.2 AA is the commitment (NF-11), so every portal page a test reaches is checked with
 * axe on the way through.
 */
export async function expectNoAccessibilityViolations(page: Page, label: string): Promise<void> {
  // Colour transitions (a button leaving its busy state) can be caught half-way, and axe then
  // judges a colour nobody sees at rest. Reduced motion makes globals.css settle them instantly.
  await page.emulateMedia({ reducedMotion: "reduce" });
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  // Names the offending elements, so a failure says where to look rather than only what.
  const summary = results.violations.map(
    (violation) =>
      `${violation.id} (${violation.nodes.length}): ${violation.help} at ${violation.nodes
        .map((node) => node.target.join(" "))
        .join(", ")}`,
  );
  expect(summary, `accessibility problems on ${label}`).toEqual([]);
}
