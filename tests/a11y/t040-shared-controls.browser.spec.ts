import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("real synthetic T040 fixture has zero axe violations in empty, malformed and valid states", async ({
  page,
}) => {
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:4179/")
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/tests/fixtures/t040-controls.html");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "T040 synthetic shared-control test fixture",
  );
  for (const draft of ["", "1,25", "123.456789"]) {
    await page.getByRole("textbox").fill(draft);
    const result = await new AxeBuilder({ page }).analyze();
    console.log("T040 axe", { draft, violations: result.violations });
    expect(result.violations).toEqual([]);
  }
});
