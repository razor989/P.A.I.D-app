import { expect, test } from "@playwright/test";

test("local blank Vite shell mounts without learner content", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator("#root")).toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
