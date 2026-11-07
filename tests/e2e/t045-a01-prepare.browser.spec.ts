import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import { enterReference, readingBeats } from "../helpers/c04-reference-journey";
import { openC04Activity } from "../helpers/c04-gallery";
test.setTimeout(120_000);
test.use({ hasTouch: true });
test("revision 2: A02 then A01 screen comparison, normal motion and action hierarchy", async ({
  page,
}, info) => {
  const capture = async (name: string) => {
    await page.locator(".c04-reference").evaluate(async (root) => {
      await Promise.all(
        root
          .getAnimations({ subtree: true })
          .filter(
            (animation) =>
              animation.effect?.getTiming().iterations !== Infinity,
          )
          .map((animation) => animation.finished.catch(() => undefined)),
      );
    });
    await page.screenshot({ path: info.outputPath(name), fullPage: true });
  };
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await enterReference(page);
  const referenceShell = await page
    .locator(".c04-reference")
    .evaluate((root) => {
      const rectangle = root.getBoundingClientRect();
      const main = document.getElementById("paid-main")!;
      const shell = main.parentElement!;
      const heading = main.querySelector("h1")!;
      return {
        x: rectangle.x,
        width: rectangle.width,
        top: rectangle.top,
        shellWidth: getComputedStyle(shell).maxInlineSize,
        padding: getComputedStyle(shell).paddingInline,
        headingWidth: heading.getBoundingClientRect().width,
        headingClip: getComputedStyle(heading).clipPath,
      };
    });
  const reference = await page.locator(".c04-reference").evaluate((root) => {
    const style = (selector: string) => {
      const element = root.querySelector(selector)!;
      const css = getComputedStyle(element);
      return {
        fontSize: css.fontSize,
        fontFamily: css.fontFamily,
        lineHeight: css.lineHeight,
        background: css.backgroundColor,
        boxShadow: css.boxShadow,
        borderRadius: css.borderRadius,
      };
    };
    return { primary: style(".primary"), lead: style(".lead") };
  });
  await capture("reference-a02-landing.png");
  for (const [index, label] of readingBeats.entries()) {
    await page.getByRole("button", { name: label, exact: false }).click();
    await capture(`reference-a02-${index}.png`);
  }
  for (let q = 0; q < 3; q++) {
    await page
      .getByRole("radio")
      .nth(q === 1 ? 1 : 0)
      .check();
    await page.getByRole("button", { name: /Check my reasoning/ }).click();
    await capture(`reference-a02-feedback-${q}.png`);
    if (q < 2) await page.locator('[data-action="primary-next"]').click();
  }
  await page.locator('[data-action="primary-finish"]').click();
  await capture("reference-a02-recap.png");
  await page
    .getByRole("button", { name: "Return to Learning Library", exact: true })
    .first()
    .click();
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await openC04Activity(page, "Prepare");
  const prepareShell = await page.locator(".c04-reference").evaluate((root) => {
    const rectangle = root.getBoundingClientRect();
    const main = document.getElementById("paid-main")!;
    const shell = main.parentElement!;
    const heading = main.querySelector("h1")!;
    return {
      x: rectangle.x,
      width: rectangle.width,
      top: rectangle.top,
      shellWidth: getComputedStyle(shell).maxInlineSize,
      padding: getComputedStyle(shell).paddingInline,
      headingWidth: heading.getBoundingClientRect().width,
      headingClip: getComputedStyle(heading).clipPath,
    };
  });
  expect(prepareShell).toEqual(referenceShell);
  const routeHeading = page.getByRole("heading", { level: 1 });
  await routeHeading.focus();
  await expect(routeHeading).toBeFocused();
  const actual = await page.locator(".c04-reference").evaluate((root) => {
    const style = (selector: string) => {
      const css = getComputedStyle(root.querySelector(selector)!);
      return {
        fontSize: css.fontSize,
        fontFamily: css.fontFamily,
        lineHeight: css.lineHeight,
        background: css.backgroundColor,
        boxShadow: css.boxShadow,
        borderRadius: css.borderRadius,
      };
    };
    return { primary: style(".primary"), lead: style(".lead") };
  });
  expect(actual).toEqual(reference);
  const introductions = await page
    .locator(".entry-copy > p")
    .evaluateAll((elements) =>
      elements.map((element) => getComputedStyle(element).fontSize),
    );
  expect(new Set(introductions).size).toBe(1);
  await capture("revised-a01-landing.png");
  await page.getByRole("button", { name: /Start with Maya/ }).click();
  const motion = await page
    .locator(".reference-main")
    .evaluate((root) =>
      root
        .getAnimations({ subtree: true })
        .map((animation) => animation.effect?.getTiming()),
    );
  expect(
    motion.some(
      (timing) =>
        timing?.duration === 420 &&
        timing.easing === "cubic-bezier(0.2, 0.75, 0.25, 1)",
    ),
  ).toBe(true);
  expect(await page.locator(".story-play svg").count()).toBe(0);
  for (const button of ["Previous moment", "Next moment"]) {
    const geometry = await page
      .getByRole("button", { name: button, exact: true })
      .evaluate((element) => {
        const outer = element.getBoundingClientRect(),
          inner = element.querySelector("svg")!.getBoundingClientRect();
        return {
          width: outer.width,
          height: outer.height,
          x: inner.left + inner.width / 2 - (outer.left + outer.width / 2),
          y: inner.top + inner.height / 2 - (outer.top + outer.height / 2),
        };
      });
    expect(geometry.width).toBe(geometry.height);
    expect(Math.abs(geometry.x)).toBeLessThan(1);
    expect(Math.abs(geometry.y)).toBeLessThan(1);
  }
  for (let index = 0; index < 6; index++) {
    await page.getByRole("slider").fill(String(index * 8500 + 5700));
    await capture(`revised-a01-story-${index}.png`);
  }
  expect(await page.locator(".story-salary").innerText()).not.toMatch(
    /\bnotice\b|\bkeep\b|\bin view\b/i,
  );
  await page.getByRole("button", { name: /Share your first thinking/ }).click();
  for (let q = 0; q < 4; q++) {
    // No submit action is offered until a response exists.
    await expect(page.locator(".choice-panel .primary")).toHaveCount(0);
    await record(page);
    await expect(page.locator(".choice-panel .primary")).toHaveCount(1);
    await capture(`revised-a01-feedback-${q}.png`);
    await page
      .getByRole("button", { name: q < 3 ? /Next question/ : /See your recap/ })
      .click();
  }
  await capture("revised-a01-recap.png");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
async function enter(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await openC04Activity(page, "Prepare");
  await expect(
    page.getByRole("heading", { name: "A review. A different salary?" }),
  ).toBeVisible();
}
async function prompts(page: Page) {
  await page.getByRole("button", { name: /Start with Maya/ }).click();
  await page.getByRole("button", { name: /Share your first thinking/ }).click();
}
async function record(page: Page, option = 2) {
  await page.getByRole("radio").nth(option).check();
  await expect(page.getByRole("button", { name: /Next question/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("heading", { name: "Thanks for sharing your idea." }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: /Share my thinking/ }).click();
  await expect(
    page.getByRole("heading", { name: "Thanks for sharing your idea." }),
  ).toBeVisible();
}
test("diagnostic alternatives, receipt/revision, Recovery, honest recap and authentic A02 continuation", async ({
  page,
}, info) => {
  await enter(page);
  await prompts(page);
  await record(page);
  await expect(
    page.getByRole("button", { name: /Next question/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Change my choice/ }).click();
  await expect(page.getByRole("button", { name: /Next question/ })).toHaveCount(
    0,
  );
  await record(page, 1);
  await page.getByRole("button", { name: /Next question/ }).click();
  await page.getByRole("radio").nth(2).check();
  await page.reload();
  await page.getByRole("button", { name: /^Resume / }).click();
  await expect(page.getByRole("radio").nth(2)).toBeChecked();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paid.recovery.checkpoint.v1")!),
  );
  expect(saved.checkpoint.responseContract).toEqual({
    id: "C04-A01-elicit-engage-v4",
    version: 4,
  });
  expect(saved.checkpoint.guidedPractice.records).toHaveLength(1);
  for (let q = 1; q < 4; q++) {
    await record(page, 2);
    expect(await page.locator(".feedback").innerText()).not.toMatch(
      /correct|reconsider|0%|100%|denominator/i,
    );
    if (q < 3)
      await page.getByRole("button", { name: /Next question/ }).click();
  }
  await page.getByRole("button", { name: /See your recap/ }).click();
  await expect(page.locator("[data-recap]")).toContainText(
    "You shared your ideas on 4 of 4 questions",
  );
  await expect(page.locator("[data-recap]")).toContainText(
    "These are starting ideas to explore, not a score",
  );
  await expect(page.locator("[data-recap]")).not.toContainText("0%");
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("v4-recap.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Explore and Learn →", exact: true })
    .click();
  await expect(page.locator("[data-c04-track]")).toHaveAttribute(
    "data-c04-track",
    "C04-A02",
  );
  await expect(
    page.getByRole("heading", { name: /Making sense/ }),
  ).toBeVisible();
});
for (const width of [320, 768, 1024, 1440])
  test(`A02 visual patterns, inspection, playback and partial recap at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    await page.screenshot({
      path: info.outputPath(`a01-entry-${width}.png`),
      fullPage: true,
    });
    await page.getByRole("button", { name: /Start with Maya/ }).click();
    await page
      .getByRole("button", { name: "04 After the review", exact: true })
      .click();
    const inspect = page.getByRole("button", {
      name: "Inspect before the review",
      exact: true,
    });
    await inspect.focus();
    await expect(
      page.getByRole("complementary", { name: "Document inspection" }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("complementary", { name: "Document inspection" }),
    ).toHaveCount(0);
    await inspect.tap();
    await expect(
      page.getByRole("complementary", { name: "Document inspection" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close document inspection" })
      .click();
    await page
      .getByRole("button", { name: "Play situation", exact: true })
      .click();
    await page.waitForTimeout(300);
    await page
      .getByRole("button", { name: "Pause situation", exact: true })
      .click();
    const position = await page.getByRole("slider").inputValue();
    await page.waitForTimeout(200);
    expect(await page.getByRole("slider").inputValue()).toBe(position);
    await page.getByRole("button", { name: "Replay from start" }).click();
    await expect(page.getByRole("slider")).toHaveValue("0");
    await page
      .getByRole("button", { name: "06 Your first thinking", exact: true })
      .click();
    await page.screenshot({
      path: info.outputPath(`a01-story-${width}.png`),
      fullPage: true,
    });
    expect(await page.locator("[data-c04-track]").innerText()).not.toMatch(
      /0%|100%|denominator|did not change/,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: /Share your first thinking/ })
      .click();
    await page.screenshot({
      path: info.outputPath(`a01-prompt-${width}.png`),
      fullPage: true,
    });
    await record(page);
    await page
      .getByRole("button", { name: "Finish here for now", exact: true })
      .click();
    await expect(page.locator("[data-recap]")).toContainText(
      "You shared your ideas on 1 of 4 questions",
    );
    await page.screenshot({
      path: info.outputPath(`a01-partial-recap-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    ).toBe(true);
  });
