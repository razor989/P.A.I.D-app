import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("axe scans the local blank shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();

  const results = await new AxeBuilder({ page }).analyze();
  const violationIds = results.violations.map(({ id }) => id).sort();
  console.log("Blank-shell axe violation IDs:", violationIds);
  expect(violationIds).toEqual([
    "document-title",
    "landmark-one-main",
    "page-has-heading-one",
  ]);
});
