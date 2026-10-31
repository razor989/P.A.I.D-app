import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";

test.setTimeout(180_000);
for (const incorrect of [false, true]) {
  test(`Q1 retained optional exploration, responsive geometry and progression: ${incorrect ? "reconsideration" : "confirmed"}`, async ({
    page,
  }, info) => {
    await page.goto("/");
    await enterReference(page);
    await readToPractice(page);
    await expect(page.locator(".check-header h2")).toBeFocused();
    await page
      .getByRole("radio")
      .nth(incorrect ? 1 : 0)
      .check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    const feedback = await page.locator("#feedback").textContent();
    if (!incorrect) {
      await expect(page.locator(".q1-pair")).toBeHidden();
      await expect(page.locator('[data-action="primary-next"]')).toBeEnabled();
      await page.locator('[data-q1-reason="total"]').click();
      await expect(page.locator(".q1-reason-feedback")).toContainText(
        "New totals include",
      );
      await page.locator('[data-q1-reason="percentage"]').click();
      await expect(page.locator(".q1-reason-feedback")).toContainText(
        "not added pesos",
      );
      await page.locator('[data-q1-reason="difference"]').click();
      await expect(page.locator(".q1-reason-feedback")).toContainText(
        "supports your answer",
      );
    } else {
      await page
        .getByRole("button", { name: "Help me inspect the comparison" })
        .click();
      await expect(page.locator("#q1-help")).toBeFocused();
      await expect(page.locator("#q1-help")).toContainText(
        "Inspect only what was added",
      );
      await page
        .getByRole("button", { name: "Connect it to the calculation" })
        .click();
      await expect(page.locator("#q1-help")).toContainText(
        "Connect each picture to subtraction",
      );
      await expect(page.locator(".q1-equation").first()).toBeVisible();
    }
    const before = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    const target = page.locator(
      `[data-q1-mode="${incorrect ? "separate" : "shares"}"]`,
    );
    const reverse = page.locator(
      `[data-q1-mode="${incorrect ? "original" : "pesos"}"]`,
    );
    await page
      .locator(".q1-pair svg")
      .first()
      .evaluate((element) => {
        (window as unknown as { q1Svg: Element }).q1Svg = element;
      });
    for (const width of [320, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      await reverse.click();
      await target.focus();
      await page.keyboard.press("Enter");
      await expect(target).toBeFocused();
      await expect(target).toHaveAttribute("aria-pressed", "true");
      expect(await page.locator("#feedback").textContent()).toBe(feedback);
      await expect(page.locator(".q1-laboratory")).toContainText(
        incorrect ? "not lost" : "0.20 = 20%",
      );
      await page.waitForTimeout(750);
      expect(await page.locator(".q1-pair svg text").count()).toBe(0);
      for (const label of await page.locator(".q1-anchor").all()) {
        expect(
          await label.evaluate((e) =>
            parseFloat(getComputedStyle(e.querySelector("span")!).fontSize),
          ),
        ).toBeGreaterThanOrEqual(14);
        expect(
          await label.evaluate((e) => {
            const a = e.getBoundingClientRect(),
              b = e
                .parentElement!.querySelector("svg")!
                .getBoundingClientRect();
            return a.bottom <= b.top || a.top >= b.bottom;
          }),
        ).toBe(true);
      }
      const geometry = await page
        .locator(".q1-pair figure")
        .evaluateAll((figures) =>
          figures.map((figure) => {
            const original = figure
                .querySelector(".story-original")!
                .getBoundingClientRect(),
              added = figure
                .querySelector(".raise-block")!
                .getBoundingClientRect();
            return {
              ratio: added.width / original.width,
              separate:
                added.right <= original.left || added.bottom <= original.top,
            };
          }),
        );
      expect(geometry[0].ratio).toBeCloseTo(0.1);
      expect(geometry[1].ratio).toBeCloseTo(0.2);
      if (incorrect) expect(geometry.every((g) => g.separate)).toBe(true);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      const axe = await new AxeBuilder({ page })
        .include(".c04-reference")
        .analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: info.outputPath(`${width}.png`),
        fullPage: true,
      });
    }
    for (let i = 0; i < 5; i++) {
      await reverse.click();
      await target.click();
    }
    expect(
      await page
        .locator(".q1-pair svg")
        .first()
        .evaluate(
          (element) =>
            element === (window as unknown as { q1Svg: Element }).q1Svg,
        ),
    ).toBe(true);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await reverse.click();
    await target.click();
    expect(
      await page
        .locator(".q1-laboratory")
        .evaluate((e) => e.getAnimations({ subtree: true }).length),
    ).toBe(0);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(
      before,
    );
    await page.setViewportSize({ width: 320, height: 1000 });
    await page.addStyleTag({ content: ":root { font-size: 200% }" });
    await page.emulateMedia({ forcedColors: "active" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator('[data-action="primary-finish"]')).toBeEnabled();
    if (incorrect) {
      await expect(page.locator('[data-action="primary-next"]')).toHaveCount(0);
      await page
        .getByRole("button", { name: "Reconsider my selection" })
        .click();
      await expect(page.locator(".q1-laboratory")).toHaveCount(0);
      await expect(page.getByRole("radio").first()).toBeEnabled();
    } else {
      await page.locator('[data-action="primary-next"]').click();
      await expect(page.locator(".practice-count")).toContainText("2 of 3");
      await expect(page.locator(".q1-laboratory")).toHaveCount(0);
    }
  });
}
