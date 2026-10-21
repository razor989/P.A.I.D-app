import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("axe accepts the genuinely resolved Session destination shell", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );

  const results = await new AxeBuilder({ page }).analyze();
  const violationIds = results.violations.map(({ id }) => id).sort();
  console.log("T036 gateway axe violation IDs:", violationIds);
  expect(results.violations).toEqual([]);
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page
    .getByRole("button", { name: "Explore and Learn", exact: true })
    .click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page.getByRole("main")).toHaveCount(1);
});
