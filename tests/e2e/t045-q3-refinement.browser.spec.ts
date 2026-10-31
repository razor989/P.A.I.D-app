import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";

test.setTimeout(300_000);
for (const answer of [0, 1, 2]) {
  test(`Q03 paired shares and actor-owned Finish: answer ${answer}`, async ({
    page,
  }, info) => {
    await page.goto("/");
    await enterReference(page);
    await readToPractice(page);
    for (const option of [0, 1]) {
      await page.getByRole("radio").nth(option).check();
      await page.getByRole("button", { name: "Check my reasoning" }).click();
      await page.locator('[data-action="primary-next"]').click();
    }
    await expect(page.locator(".practice-count")).toContainText("3 of 3");
    await page.getByRole("radio").nth(answer).check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    const feedback = await page.locator("#feedback").textContent();
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    await expect(page.locator('[data-action="primary-finish"]')).toBeEnabled();
    if (answer < 2) {
      await page
        .getByRole("button", { name: "Help me inspect the comparison" })
        .click();
      await expect(page.locator("#q3-help")).toBeFocused();
      await expect(page.locator("#q3-help")).toContainText(
        "Compare the shares",
      );
      await expect(page.locator(".q3-share").first()).toBeVisible();
      await expect(page.locator(".q3-calculation").first()).toBeHidden();
    } else {
      await expect(page.locator(".q3-pair")).toBeHidden();
      await expect(page.locator(".q3-insight")).toBeHidden();
    }
    for (const [choice, text] of [
      ["equal", "Equal pesos describe"],
      ["higher", "A’s higher salary"],
      ["smaller", "That relationship fits"],
    ]) {
      await page.locator(`[data-q3-choice="${choice}"]`).focus();
      await page.keyboard.press("Enter");
      await expect(page.locator("#q3-response")).toContainText(text!);
      await expect(page.locator("#q3-response")).toBeFocused();
    }
    if (answer < 2) {
      await expect(page.locator(".q3-calculation").first()).toBeHidden();
      await page
        .getByRole("button", { name: "Connect it to the calculation" })
        .click();
      await expect(page.locator("#q3-help")).toBeFocused();
      await expect(page.locator("#q3-help")).toContainText(
        "Connect each share",
      );
    }
    await expect(
      page.locator('[data-employee="A"] .q3-calculation'),
    ).toContainText("0.10");
    await expect(
      page.locator('[data-employee="B"] .q3-calculation'),
    ).toContainText("0.20");
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
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
    if (answer < 2) {
      await page
        .getByRole("button", { name: "Reconsider my selection" })
        .click();
      await expect(page.locator(".q3-laboratory")).toHaveCount(0);
      await page.getByRole("radio").nth(2).check();
      await page.getByRole("button", { name: "Check my reasoning" }).click();
      await expect(page.locator(".q3-pair")).toBeHidden();
    }
    await page.locator('[data-action="primary-finish"]').click();
    await expect(page.locator(".completion")).toContainText("question 3 of 3");
    await expect(page.locator(".q3-laboratory")).toHaveCount(0);
  });
}
