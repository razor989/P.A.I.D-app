import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("axe accepts the genuinely resolved T036 startup gateway", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.getByRole("status")).toHaveText("Library is ready.");

  const results = await new AxeBuilder({ page }).analyze();
  const violationIds = results.violations.map(({ id }) => id).sort();
  console.log("T036 gateway axe violation IDs:", violationIds);
  expect(results.violations).toEqual([]);
});
