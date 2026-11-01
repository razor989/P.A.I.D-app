import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
test.setTimeout(90_000);
for (const width of [1366, 390])
  test(`everyday visual story ${width}px: learner pacing, replay and static parity`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await enter(page);
    await primary(page);
    await check(page);
    await finish(page);
    await page
      .getByRole("button", { name: "Percentage Change Ideas Together →" })
      .click();
    await page
      .getByRole("button", { name: "See it in everyday life →" })
      .click();
    const story = page.locator("[data-transfer-story]");
    await expect(
      page.getByRole("region", { name: "Percentage change connections" }),
    ).toHaveCount(0);
    await expect(
      story.getByRole("heading", { name: "At the shop" }),
    ).toBeFocused();
    for (const [index, result] of [
      "25% increase",
      "20% decrease",
      "Percentage change undefined",
    ].entries()) {
      await expect(story.getByRole("status")).toHaveCount(0);
      await story
        .getByRole("button", { name: "Show me the comparison" })
        .click();
      await expect(story.getByRole("status")).toContainText(result);
      await expect
        .poll(() =>
          story
            .locator('[data-revealed] [class*="storyChange"]')
            .evaluate((el) => getComputedStyle(el).opacity),
        )
        .toBe("1");
      await page.screenshot({
        path: info.outputPath(`story-${index}.png`),
        fullPage: true,
      });
      await story.getByRole("button", { name: "Replay scene ↻" }).click();
      await page.emulateMedia({ reducedMotion: "reduce" });
      expect(
        await story.evaluate(
          (el) =>
            el
              .getAnimations({ subtree: true })
              .filter((a) => a.playState === "running").length,
        ),
      ).toBe(0);
      await expect(story.getByRole("status")).toContainText(result);
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await story.getByRole("button", { name: "Next scene →" }).click();
    }
    await expect(
      story.getByRole("heading", { name: "What did we start with?" }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath("story-connection.png"),
      fullPage: true,
    });
    await story.getByRole("button", { name: "← Previous scene" }).click();
    await expect(
      story.getByRole("heading", { name: "A new beginning" }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Return to the Learning Library →" })
      .click();
    await expect(
      page.getByRole("button", { name: "Percentage Change", exact: true }),
    ).toBeVisible();
  });
test("reference bars move together, keep the added amount fixed, and respect reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await enter(page);
  await primary(page);
  await check(page);
  await finish(page);
  await page
    .getByRole("button", { name: "Percentage Change Ideas Together →" })
    .click();
  const model = page.locator("[data-reference-model]");
  const geometry = () =>
    model.evaluate((svg) => ({
      bars: Array.from(
        svg.querySelectorAll<SVGRectElement>("[data-reference-bar]"),
      ).map((bar) => bar.getBBox().width),
      added: svg
        .querySelector<SVGRectElement>("[data-moving-addition] rect")!
        .getBBox().width,
      shift: new DOMMatrix(
        getComputedStyle(svg.querySelector("[data-moving-addition]")!)
          .transform,
      ).m41,
      active: svg
        .getAnimations({ subtree: true })
        .filter((a) => a.playState === "running").length,
    }));
  await page.getByRole("radio", { name: "₱3,000 original" }).check();
  await expect.poll(async () => (await geometry()).active).toBeGreaterThan(0);
  const moving = await geometry();
  expect(moving.bars[0]).toBeGreaterThanOrEqual(1500 / 9 - 0.1);
  expect(moving.bars[0]).toBeLessThan(3000 / 9);
  expect(moving.added).toBeCloseTo(1500 / 9, 2);
  expect(moving.shift).toBeCloseTo(moving.bars[0]!, 1);
  await expect
    .poll(async () => (await geometry()).bars[0])
    .toBeCloseTo(3000 / 9, 2);
  // Interrupt a shrink with a new selection: the same nodes retarget smoothly.
  await page.getByRole("radio", { name: "₱0 original" }).check();
  await page.getByRole("radio", { name: "₱1,500 original" }).check();
  await expect
    .poll(async () => (await geometry()).bars[0])
    .toBeCloseTo(1500 / 9, 2);
  await page.getByRole("radio", { name: "₱0 original" }).check();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(async () => (await geometry()).active).toBe(0);
  expect((await geometry()).bars).toEqual([0, 0]);
  await page.getByRole("radio", { name: "₱3,000 original" }).check();
  const reduced = await geometry();
  expect(reduced.active).toBe(0);
  expect(reduced.bars[0]).toBeCloseTo(3000 / 9, 2);
  expect(reduced.added).toBeCloseTo(1500 / 9, 2);
});
async function enter(page: Page, fixture = false) {
  await page.goto(fixture ? "/tests/fixtures/t045-c04-reference.html" : "/");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Check and Transfer", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /Something new/ }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(0);
  await page.getByRole("button", { name: "Consider the allowance →" }).click();
}
async function primary(page: Page, wrong = false) {
  await page
    .getByRole("textbox", { name: /^Change in allowance/ })
    .fill(wrong ? "0" : "₱1,500");
  const field = page
    .locator("details")
    .filter({ hasText: "Response for percentage change" });
  await field.getByText("Not a numerical value?", { exact: true }).click();
  await field.getByRole("combobox").selectOption("UNDEFINED");
  await expect(
    page.getByRole("button", { name: "Commit my calculation →" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Commit my calculation →" }).click();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
}
async function check(page: Page, wrong = false) {
  await page
    .getByRole("radio")
    .nth(wrong ? 1 : 0)
    .check();
  await page
    .getByRole("button", { name: "Check my response", exact: true })
    .click();
  await expect(page.locator("[data-feedback]")).toContainText(
    wrong ? "Do not report" : "Confirmed.",
  );
  await expect(page.locator("[data-terminal]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Finish activity", exact: true }),
  ).toHaveCount(0);
}
async function finish(page: Page) {
  await page
    .getByRole("button", { name: "Look at the relationship →" })
    .click();
  await expect(page.locator("[data-terminal]")).toContainText(
    "Percentage change undefined.",
  );
  await expect(
    page.getByRole("button", { name: "Finish activity", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Finish activity", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /A new allowance/, level: 2 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your recorded response" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Next activity|Continue completed activity/,
    }),
  ).toHaveCount(0);
}
for (const wrong of [false, true])
  test(`real production route: independent commitments and ${wrong ? "incorrect" : "correct"} outcome`, async ({
    page,
  }, info) => {
    await enter(page);
    const track = page.locator('[data-c04-track="C04-A04"]');
    expect(await track.innerHTML()).not.toMatch(
      /division by zero|formula requires division|percentage is undefined|₱1,500 − ₱0|data-terminal/,
    );
    expect(await track.locator("[data-zero-bar]").getAttribute("width")).toBe(
      "0",
    );
    await page.screenshot({
      path: info.outputPath("primary.png"),
      fullPage: true,
    });
    await primary(page, wrong);
    await expect(
      page.getByRole("button", { name: "Check my response", exact: true }),
    ).toBeDisabled();
    await page.getByRole("radio").nth(1).check();
    await page.getByRole("button", { name: "← Change my calculation" }).click();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: /^Change in allowance/ }),
    ).toHaveValue(wrong ? "0" : "1500");
    await page.getByRole("button", { name: "Commit my calculation →" }).click();
    await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
    const reasoningText = await page
      .getByRole("radio")
      .nth(wrong ? 1 : 0)
      .locator("..")
      .locator("span")
      .last()
      .textContent();
    await page.screenshot({
      path: info.outputPath("reasoning.png"),
      fullPage: true,
    });
    await check(page, wrong);
    await page.screenshot({
      path: info.outputPath("feedback.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Look at the relationship →" })
      .click();
    await expect(page.locator("[data-terminal]")).toContainText(
      "Percentage change undefined.",
    );
    await page
      .getByRole("button", {
        name: "Inspect the original allowance",
        exact: true,
      })
      .focus();
    await expect(
      page.getByRole("complementary", { name: "Allowance inspection" }),
    ).toContainText("zero length");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Review the relationship", exact: true })
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Close review", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Review the relationship",
        exact: true,
      }),
    ).toBeFocused();
    await page.screenshot({
      path: info.outputPath("terminal.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Finish activity", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your recorded response" }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("completion.png"),
      fullPage: true,
    });
    const record = page.getByRole("region", {
      name: "Your recorded response",
    });
    await expect(record).toContainText(wrong ? "₱0" : "₱1500");
    await expect(record).toContainText(
      wrong ? "Reconsideration" : "Confirmation",
    );
    await expect(record).not.toContainText("unavailable");
    await expect(record).toContainText("Your explanation");
    await expect(record).toContainText(reasoningText!);
    await page
      .getByRole("button", { name: "Percentage Change Ideas Together →" })
      .click();
    await expect(
      page.getByRole("heading", { name: /The change tells a story/ }),
    ).toBeFocused();
    await expect(
      page.getByRole("radio", { name: "₱1,500 original" }),
    ).toBeChecked();
    await page.getByRole("button", { name: "Reveal the comparison" }).click();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "₱3,000 original" }).check();
    await expect(page.getByText("100%", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal the comparison" }).click();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    await page.getByRole("radio", { name: "₱0 original" }).check();
    await page.getByRole("button", { name: "Reveal the comparison" }).click();
    await expect(page.getByText("Undefined", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("img", { name: /Original ₱0. New ₱1,500/ }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("conclusion.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Return to the Learning Library →" })
      .click();
    await expect(
      page.getByRole("button", { name: "Percentage Change", exact: true }),
    ).toBeVisible();
  });
test("authentic visible feedback and terminal receipts are separate for both outcomes", async ({
  page,
}) => {
  for (const wrong of [false, true]) {
    await enter(page, true);
    await primary(page, wrong);
    await check(page, wrong);
    const inspect = () =>
      page.evaluate(() =>
        (
          window as unknown as {
            t045: {
              inspect(): { receipts: { type: string; visible: boolean }[] };
            };
          }
        ).t045.inspect(),
      );
    expect((await inspect()).receipts.map((r) => r.type)).toEqual([
      "FEEDBACK_DELIVERED",
    ]);
    await finish(page);
    const receipts = (await inspect()).receipts;
    expect(receipts.map((r) => r.type)).toEqual([
      "FEEDBACK_DELIVERED",
      "TERMINAL_TEACHING_DELIVERED",
    ]);
    expect(receipts.every((r) => r.visible)).toBe(true);
    await page
      .getByRole("button", { name: "Percentage Change Ideas Together →" })
      .click();
    await page.getByRole("button", { name: "← Back to your recap" }).click();
    expect((await inspect()).receipts).toEqual(receipts);
  }
});
test("recovery preserves committed calculation; revision clears reasoning and requires a new check", async ({
  page,
}) => {
  await enter(page);
  await primary(page, true);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
  await check(page, true);
  await page
    .getByRole("button", { name: "Revise my response", exact: true })
    .click();
  if (
    await page.getByRole("button", { name: "← Change my calculation" }).count()
  )
    await page.getByRole("button", { name: "← Change my calculation" }).click();
  await expect(
    page.getByRole("textbox", { name: /^Change in allowance/ }),
  ).toHaveValue("0");
  await page
    .getByRole("textbox", { name: /^Change in allowance/ })
    .fill("1,500");
  await page.getByRole("button", { name: "Commit my calculation →" }).click();
  await check(page);
  await finish(page);
});
test("an incorrect numerical percentage remains the submitted percentage in the recap", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("textbox", { name: /^Change in allowance/ })
    .fill("1500");
  await page.getByRole("textbox", { name: /^Percentage change/ }).fill("100");
  await page.getByRole("button", { name: "Commit my calculation →" }).click();
  await check(page, true);
  await finish(page);
  const record = page.getByRole("region", {
    name: "Your recorded response",
  });
  await expect(record).toContainText("100%");
  await expect(record).toContainText("Reconsideration");
  await expect(
    page.getByRole("region", { name: "What the relationship showed" }),
  ).toContainText("Undefined");
});

test("touch can inspect the model, move from recap to conclusion and exit", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    await enter(page);
    await primary(page);
    await check(page);
    await finish(page);
    await page
      .getByRole("button", {
        name: "Inspect the original allowance",
        exact: true,
      })
      .tap();
    await expect(
      page.getByRole("complementary", { name: "Allowance inspection" }),
    ).toContainText("zero length");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("touch-recap.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Percentage Change Ideas Together →" })
      .tap();
    await page.screenshot({
      path: info.outputPath("touch-conclusion.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Return to the Learning Library →" })
      .tap();
    await expect(
      page.getByRole("button", { name: "Percentage Change", exact: true }),
    ).toBeVisible();
  } finally {
    await context.close();
  }
});

for (const width of [320, 390, 683, 1024, 1366])
  test(`responsive ${width}px, keyboard, reduced motion and axe`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await primary(page);
    await check(page);
    await page
      .getByRole("button", { name: "Look at the relationship →" })
      .click();
    const inspect = page.getByRole("button", {
      name: "Inspect the peso increase",
      exact: true,
    });
    await inspect.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("complementary", { name: "Allowance inspection" }),
    ).toContainText("defined difference");
    await page.keyboard.press("Escape");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`terminal-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Finish activity", exact: true })
      .click();
    await page.emulateMedia({ forcedColors: "active" });
    await expect(
      page.getByRole("heading", { name: "Your recorded response" }),
    ).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`recap-${width}.png`),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Percentage Change Ideas Together →" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: /The change tells a story/ }),
    ).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`conclusion-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: "← Back to your recap" }).click();
    await expect(
      page.getByRole("heading", { name: /A new allowance/, level: 2 }),
    ).toBeFocused();
  });
