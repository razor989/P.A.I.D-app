import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";

test.setTimeout(300_000);
test("recap entrance and review-return have bounded motion, with immediate reduced-motion cancellation", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (frames, options) {
      const animation = animate.call(this, frames, options);
      if (this.closest("[data-recap]")) {
        animation.pause();
        animation.currentTime = 140;
      }
      return animation;
    };
  });
  await page.goto("/");
  await enterReference(page);
  await readToPractice(page);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await page.locator('[data-action="primary-finish"]').click();
  const recap = page.locator("[data-recap]");
  await expect
    .poll(() =>
      recap.evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(7);
  for (const width of [320, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.screenshot({
      path: info.outputPath(`entrance-${width}.png`),
      fullPage: true,
    });
  }
  expect(
    await recap
      .locator("svg")
      .evaluateAll((nodes) =>
        nodes.every(
          (node) => node.getAnimations({ subtree: true }).length === 0,
        ),
      ),
  ).toBe(true);
  await recap.evaluate((node) =>
    node
      .getAnimations({ subtree: true })
      .forEach((animation) => animation.finish()),
  );
  await expect
    .poll(() =>
      recap.evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Revisit the explanation" }).click();
  await page.getByRole("button", { name: "Return to completion" }).click();
  await expect
    .poll(() =>
      recap.evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(1);
  expect(
    await recap.evaluate(
      (node) => node.getAnimations()[0]?.effect?.getTiming().duration,
    ),
  ).toBe(240);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect
    .poll(() =>
      recap.evaluate((node) => node.getAnimations({ subtree: true }).length),
    )
    .toBe(0);
  await page.getByRole("button", { name: "Revisit the explanation" }).click();
  await page.getByRole("button", { name: "Return to completion" }).click();
  expect(
    await recap.evaluate(
      (node) => node.getAnimations({ subtree: true }).length,
    ),
  ).toBe(0);
  await expect(recap.locator("h2")).toBeFocused();
});
for (const outcome of ["early-correct", "early-incorrect", "full"]) {
  test(`recap worked summary, scales and return: ${outcome}`, async ({
    page,
  }, info) => {
    await page.goto("/");
    await enterReference(page);
    await readToPractice(page);
    if (outcome === "full") {
      for (const option of [0, 1]) {
        await page.getByRole("radio").nth(option).check();
        await page.getByRole("button", { name: "Check my reasoning" }).click();
        await page.locator('[data-action="primary-next"]').click();
      }
    }
    await page
      .getByRole("radio")
      .nth(outcome === "early-correct" ? 0 : 2)
      .check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    await page.locator('[data-action="primary-finish"]').click();
    const recap = page.locator("[data-recap]");
    await expect(recap.locator("h2")).toBeFocused();
    await expect(recap).toContainText(
      `practice ended at question ${outcome === "full" ? 3 : 1} of 3`,
    );
    await expect(recap.locator(".completion-seal")).toBeVisible();
    await expect(recap.locator(".recap-takeaway")).toContainText(
      "Different percentage increases.",
    );
    await expect(recap).not.toContainText("independent mastery");
    await expect(recap.locator(".recap-result")).toHaveText([
      "10%increase",
      "20%increase",
    ]);
    await expect(recap).toContainText("different peso amounts");
    for (const [employee, denominator, decimal] of [
      ["A", "₱20,000", "0.10"],
      ["B", "₱10,000", "0.20"],
    ]) {
      await expect(
        recap.locator(
          `[data-recap-employee="${employee}"][data-scale="own-original"]`,
        ),
      ).toContainText(`₱2,000 ÷ ${denominator} = ${decimal}`);
    }
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage }),
    );
    const summary = await recap.elementHandle();
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
    await page.getByRole("button", { name: "Revisit the explanation" }).click();
    await expect(recap).toHaveCount(0);
    await page.getByRole("button", { name: "Return to completion" }).click();
    expect(
      await summary!.evaluate(
        (node) => node === document.querySelector("[data-recap]"),
      ),
    ).toBe(true);
    await expect(recap.locator("h2")).toBeFocused();
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).toBe(
      storage,
    );
    await expect
      .poll(() =>
        recap.evaluate((node) => node.getAnimations({ subtree: true }).length),
      )
      .toBe(0);
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
    await page
      .getByRole("button", {
        name: "Return to the Learning Library",
        exact: true,
      })
      .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Learning Library",
    );
  });
}
