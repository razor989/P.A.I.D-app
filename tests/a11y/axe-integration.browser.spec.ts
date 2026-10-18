import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("axe accepts the accessible unresolved T035 shell", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.getByRole("status")).toContainText("Startup is unresolved");

  const results = await new AxeBuilder({ page }).analyze();
  const violationIds = results.violations.map(({ id }) => id).sort();
  console.log("T035 shell axe violation IDs:", violationIds);
  expect(results.violations).toEqual([]);
});
