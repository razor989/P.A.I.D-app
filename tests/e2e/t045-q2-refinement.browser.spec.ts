import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";

test.setTimeout(300_000);
for (const incorrect of [false, true]) {
  test(`Q02 reference pair, reasoning and unchanged progression: ${incorrect ? "reconsideration" : "confirmed"}`, async ({
    page,
  }, info) => {
    await page.goto("/");
    await enterReference(page);
    await readToPractice(page);
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    await page.locator('[data-action="primary-next"]').click();
    await expect(page.locator(".practice-count")).toContainText("2 of 3");
    await page
      .getByRole("radio")
      .nth(incorrect ? 0 : 1)
      .check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    const feedback = await page.locator("#feedback").textContent();
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    await expect(page.locator('[data-action="primary-finish"]')).toBeEnabled();
    if (incorrect) {
      await expect(page.locator('[data-action="primary-next"]')).toHaveCount(0);
      await page
        .getByRole("button", { name: "Help me inspect the comparison" })
        .click();
      await expect(page.locator("#q2-help")).toBeFocused();
      await expect(page.locator("#q2-help")).toContainText(
        "Identify each starting whole",
      );
      await expect(page.locator(".q2-fraction").first()).toBeHidden();
      for (const [choice, copy] of [
        ["change", "numerator"],
        ["new", "new totals"],
        ["original", "starting wholes"],
      ]) {
        await page.locator(`[data-q2-choice="${choice}"]`).click();
        await expect(page.locator("#q2-response")).toContainText(copy);
        await expect(page.locator("#q2-response")).toBeFocused();
      }
      await page
        .getByRole("button", { name: "Connect it to the calculation" })
        .click();
      await expect(page.locator("#q2-help")).toBeFocused();
      await expect(page.locator("#q2-help")).toContainText(
        "Put each original beneath its change",
      );
    } else {
      await expect(page.locator('[data-action="primary-next"]')).toBeEnabled();
      await expect(page.locator(".q2-pair")).toBeHidden();
      await expect(page.locator(".q2-insight")).toBeHidden();
      for (const [choice, copy] of [
        ["shared", "Equal changes do not"],
        ["new", "New salaries include"],
        ["own", "supports the pair"],
      ]) {
        await page.locator(`[data-q2-choice="${choice}"]`).focus();
        await page.keyboard.press("Enter");
        await expect(page.locator("#q2-response")).toContainText(copy);
        await expect(page.locator("#q2-response")).toBeFocused();
      }
    }
    await expect(
      page.locator('.q2-model[data-employee="A"] .q2-fraction'),
    ).toContainText("₱20,000");
    await expect(
      page.locator('.q2-model[data-employee="B"] .q2-fraction'),
    ).toContainText("₱10,000");
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const label of await page.locator(".q2-labels > div").all()) {
        expect(
          await label.evaluate((e) =>
            parseFloat(getComputedStyle(e.querySelector("span")!).fontSize),
          ),
        ).toBeGreaterThanOrEqual(14);
        expect(
          await label.evaluate(
            (e) =>
              e.getBoundingClientRect().bottom <=
              e.closest("figure")!.querySelector("svg")!.getBoundingClientRect()
                .top,
          ),
        ).toBe(true);
      }
      expect(
        (await new AxeBuilder({ page }).include(".c04-reference").analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${width}.png`),
        fullPage: true,
      });
    }
    expect(await page.locator("#feedback").textContent()).toBe(feedback);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(
      storage,
    );
    await page.emulateMedia({
      reducedMotion: "reduce",
      forcedColors: "active",
    });
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.addStyleTag({ content: ":root {font-size:200%}" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (incorrect) {
      await page
        .getByRole("button", { name: "Reconsider my selection" })
        .click();
      await expect(page.locator(".q2-laboratory")).toHaveCount(0);
      await expect(page.getByRole("radio").first()).toBeEnabled();
      await page.getByRole("radio").nth(1).check();
      await page.getByRole("button", { name: "Check my reasoning" }).click();
      await expect(page.locator(".q2-pair")).toBeHidden();
      await expect(page.locator('[data-action="primary-next"]')).toBeEnabled();
    }
    // No successful formative response is needed for actor-authorized progression.
    await page.locator('[data-action="primary-next"]').click();
    await expect(page.locator(".practice-count")).toContainText("3 of 3");
    await expect(page.locator(".q2-laboratory")).toHaveCount(0);
  });
}
