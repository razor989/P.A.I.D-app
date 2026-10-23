import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test("real T041 feedback, technical, expanded and modal states have no axe violations or withheld exposure", async ({
  page,
}) => {
  const external: string[] = [];
  await page.route("**/*", (route) => {
    if (route.request().url().startsWith("http://127.0.0.1:4179/"))
      return route.continue();
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto("/tests/fixtures/t041-surfaces.html");
  const results: unknown[] = [];
  for (const state of [
    "initial",
    "Supply Confirmation",
    "Supply Reconsideration",
    "Authorize Information Needed",
    "Open expanded Review",
    "Open expanded Source Review",
    "Open compact Review",
    "Open compact Source Review",
  ]) {
    if (state !== "initial")
      await page.getByRole("button", { name: state, exact: true }).click();
    const result = await new AxeBuilder({ page }).analyze();
    results.push({
      state,
      violations: result.violations,
      passes: result.passes.map((p) => p.id),
      snapshot: await page.locator("body").ariaSnapshot(),
    });
    expect(result.violations).toEqual([]);
    expect(await page.locator("body").innerHTML()).not.toMatch(
      /FORBIDDEN_ANSWER|PRIVATE_PROVIDER|FORBIDDEN_FIELD/,
    );
    if (state.startsWith("Open")) {
      if (state.includes("compact")) await page.keyboard.press("Escape");
      else
        await page
          .getByRole("complementary")
          .getByRole("button", { name: "Close support" })
          .click();
    }
  }
  expect(external).toEqual([]);
  if (process.env.T041_EVIDENCE_DIR)
    fs.writeFileSync(
      path.join(
        process.env.T041_EVIDENCE_DIR,
        `axe-results-${Date.now()}.json`,
      ),
      JSON.stringify({ results, external }, null, 2),
    );
  console.log("T041 axe state results", JSON.stringify(results));
});
