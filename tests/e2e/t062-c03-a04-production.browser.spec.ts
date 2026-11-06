import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openGalleryActivity } from "../helpers/activity-gallery";

test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });
for (const width of [1440, 320]) {
  test(`A04 evaluation, recovery and competency finale at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    const shot = async (name: string) =>
      page.screenshot({
        path: test.info().outputPath(`${name}.png`),
        fullPage: true,
        animations: "disabled",
      });
    const noAnswer = async () =>
      expect(page.getByText("₱936.00", { exact: true })).toHaveCount(0);
    const noOverflow = async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    const step = async (name: RegExp) =>
      page.getByRole("button", { name }).click();
    const motionEvidence = async (selector: string, name: string) => {
      const evidence = await page.locator(selector).evaluate((node) => {
        const animations = node.getAnimations({ subtree: true });
        for (const animation of animations) {
          animation.pause();
          animation.currentTime = 350;
        }
        return animations.map((animation) => ({
          frames: (animation.effect as KeyframeEffect).getKeyframes(),
          timing: animation.effect?.getTiming(),
        }));
      });
      if (width === 1440) expect(evidence.length).toBeGreaterThan(0);
      else expect(evidence).toEqual([]);
      await page.screenshot({
        path: test.info().outputPath(`${name}.png`),
        fullPage: true,
        animations: "allow",
      });
      await page
        .locator(selector)
        .evaluate((node) =>
          node.getAnimations({ subtree: true }).forEach((a) => a.finish()),
        );
      await test.info().attach(`${name}.json`, {
        body: JSON.stringify(evidence, null, 2),
        contentType: "application/json",
      });
    };
    await page.goto("/");
    await page
      .getByRole("button", { name: "Overtime Pay", exact: true })
      .click();
    await openGalleryActivity(page, "Check and Transfer");
    await expect(
      page.getByRole("heading", { name: /A different day/ }),
    ).toBeVisible();
    await noAnswer();
    await shot("a04-landing");
    await page
      .getByRole("button", { name: "Open Mara’s work record", exact: true })
      .click();
    await page.getByRole("radio", { name: "rest day", exact: true }).check();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Applicable overtime multiplier" })
      .fill("1.69");
    await page
      .getByRole("button", {
        name: "Open the relationship reference",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("region", {
        name: "Regular-holiday relationship reference",
      }),
    ).toBeFocused();
    await motionEvidence(
      'section:has(> [aria-label="Regular-holiday relationship reference"])',
      "reference-transition",
    );
    await expect(
      page.getByText(/The regular-holiday condition determines/),
    ).toBeVisible();
    await noAnswer();
    await page
      .getByRole("button", { name: "Return to my reasoning", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Review the relationship",
        exact: true,
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await page
      .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
      .fill("900");
    await page.reload();
    await page
      .getByRole("button", {
        name: "Continue unfinished activity",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("radio", { name: "rest day", exact: true }),
    ).toBeChecked();
    await step(/03\s*Calculate the pay/);
    await expect(
      page.getByRole("textbox", { name: "Overtime pay (₱)", exact: true }),
    ).toHaveValue("900");
    await page.locator('button[data-inspect="hours"]:visible').click();
    const popup = page.getByRole("region", {
      name: "Only the three extra hours",
      exact: true,
    });
    await expect(popup).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await popup.getByRole("button", { name: "Close inspection" }).click();
    await expect(
      page.locator('button[data-inspect="hours"]:visible'),
    ).toBeFocused();
    await expect(popup).toHaveCount(0);
    await page
      .getByRole("button", { name: "Check my reasoning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Let the day choose the rule." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "See my worked recap", exact: true }),
    ).toHaveCount(0);
    await noAnswer();
    await shot("a04-reconsideration");
    await expect(
      page.getByRole("region", { name: "Revisit the evidence" }),
    ).toHaveAttribute("data-diagnostic", "condition");
    await page
      .getByRole("button", { name: "Revisit my condition", exact: true })
      .click();
    await step(/01\s*Read the day/);
    await page
      .getByRole("radio", { name: "regular holiday", exact: true })
      .check();
    await step(/03\s*Calculate the pay/);
    await page
      .getByRole("button", { name: "Check my reasoning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Reconnect the day and its multiplier.",
      }),
    ).toBeVisible();
    await noAnswer();
    await shot("a04-multiplier-guidance");
    await page
      .getByRole("button", { name: "Revisit my multiplier", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Which rule follows from that day?",
        exact: true,
      }),
    ).toBeFocused();
    await step(/02\s*Apply its rule/);
    await page
      .getByRole("textbox", { name: "Applicable overtime multiplier" })
      .fill("2.60");
    await step(/03\s*Calculate the pay/);
    await page
      .getByRole("button", { name: "Check my reasoning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Follow the factors through the record.",
      }),
    ).toBeVisible();
    await noAnswer();
    await page
      .getByRole("button", { name: "Revisit my calculation", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
      .fill("936");
    await shot("a04-workspace");
    await noOverflow();
    await page
      .getByRole("button", { name: "Check my reasoning", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Your reasoning holds together." }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "See my worked recap", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /A new condition/ }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Revisit Mara’s work record", exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Mara’s regular-holiday work record" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Close Mara’s record", exact: true })
      .click();
    await shot("a04-recap");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", {
        name: "Overtime Pay: Ideas Together",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("heading", { name: /Different days/ }),
    ).toBeVisible();
    await page.getByRole("radio", { name: "Rest day", exact: true }).check();
    await page
      .getByRole("button", { name: "Reveal the connection", exact: true })
      .click();
    await expect(
      page.getByText("₱338.00", { exact: true }).first(),
    ).toBeVisible();
    await shot("a04-synthesis");
    await noOverflow();
    await expect(
      page.getByRole("region", {
        name: "Continue to the cinematic conclusion",
      }),
    ).toBeVisible();
    for (const intermediate of [768, 1024]) {
      if (width === 1440) {
        await page.setViewportSize({ width: intermediate, height: 1000 });
        await noOverflow();
        await shot(`a04-synthesis-${intermediate}`);
      }
    }
    await page.setViewportSize({ width, height: 1000 });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Beyond the work record", exact: true })
      .click();
    await motionEvidence(
      '[data-transfer-completion="finale"]',
      "conclusion-wipe",
    );
    for (let i = 0; i < 4; i++) {
      if (i < 3)
        await page
          .getByRole("button", { name: "Follow the connection", exact: true })
          .click();
      await shot(`a04-finale-${i + 1}`);
      await noOverflow();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      if (i < 3)
        await page
          .getByRole("button", { name: "Next scene", exact: true })
          .click();
    }
    await expect(
      page.getByRole("heading", {
        name: "Extra hours tell part of the story.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", {
        name: "Extra hours tell part of the story.",
        exact: true,
      }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Watch again", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "A workday ends. The record continues.",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Return to Overtime Pay", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review completed activity", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /A new condition/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
