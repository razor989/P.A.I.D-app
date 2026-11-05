import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";
import { openC04Activity } from "../helpers/c04-gallery";

test.setTimeout(300_000);
for (const scenario of ["early-correct", "early-incorrect", "full"] as const) {
  test(`latest completed explanation components survive revisit and remount: ${scenario}`, async ({
    page,
  }, info) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await enterReference(page);
    await readToPractice(page);
    await page
      .getByRole("radio")
      .nth(scenario === "early-incorrect" ? 2 : 0)
      .check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    if (scenario === "full") {
      for (const option of [1, 2]) {
        await page.locator('[data-action="primary-next"]').click();
        await page.getByRole("radio").nth(option).check();
        await page.getByRole("button", { name: "Check my reasoning" }).click();
      }
    }
    await page.locator('[data-action="primary-finish"]').click();
    const ending = `question ${scenario === "full" ? 3 : 1} of 3`;
    await expect(page.locator("[data-recap]")).toContainText(ending);
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    for (const visit of ["direct", "remounted"]) {
      if (visit === "remounted") {
        await page.getByRole("button", { name: "Back", exact: true }).click();
        await page
          .getByRole("button", { name: "Review completed activity" })
          .click();
      }
      await page
        .getByRole("button", { name: "Revisit the explanation" })
        .click();
      for (const [step, selector] of [
        [1, ".story-salary"],
        [2, ".story-salary"],
        [3, ".comparison-salary"],
        [4, ".formula-explanation-host .story-salary"],
      ] as const) {
        await page
          .locator(`[data-action="review-stage"][data-step="${step}"]`)
          .click();
        await expect(page.locator(selector)).toBeVisible();
        await expect(page.getByRole("radio")).toHaveCount(0);
        await expect(page.locator('[data-action="primary-check"]')).toHaveCount(
          0,
        );
        await page.screenshot({
          path: info.outputPath(`${visit}-stage-${step}.png`),
          fullPage: true,
        });
      }
      await page.getByRole("button", { name: "Return to completion" }).click();
      await expect(page.locator("[data-recap]")).toContainText(ending);
      expect(
        await page.evaluate(() => JSON.stringify({ ...localStorage })),
      ).toBe(storage);
    }
  });
}
test("retained completed review, reading return, Back, Library, fresh Replay and reload remain distinct", async ({
  page,
}, info) => {
  await page.goto("/");
  await enterReference(page);
  await readToPractice(page);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await page.locator('[data-action="primary-finish"]').click();
  await expect(page.locator("[data-recap]")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeEnabled();
  const storage = await page.evaluate(() =>
    JSON.stringify({ ...localStorage }),
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  const review = page.getByRole("button", {
    name: "Review completed activity",
  });
  await expect(review).toBeVisible();
  await review.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-recap]")).toContainText("question 1 of 3");
  await page.getByRole("button", { name: "Revisit the explanation" }).click();
  await page.getByRole("button", { name: "Return to completion" }).click();
  await expect(page.locator("[data-recap]")).toBeVisible();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(
    storage,
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(review).toBeFocused();
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`review-entry-${width}.png`),
      fullPage: true,
    });
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await review.click();
  await page
    .getByRole("button", { name: "Return to Learning Library", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Learning Library", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await expect(review).toBeVisible();
  await openC04Activity(page, "Explore and Learn");
  await expect(page.locator("[data-recap]")).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(review).toHaveCount(0);
  await page.reload();
  await expect(review).toHaveCount(0);
});
