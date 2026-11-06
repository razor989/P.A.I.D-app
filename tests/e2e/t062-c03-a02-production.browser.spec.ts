import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  expectGalleryActivityOffered,
  openGalleryActivity,
} from "../helpers/activity-gallery";

test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`A02 graphical production investigation (${reducedMotion})`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({
      width: reducedMotion === "reduce" ? 320 : 1440,
      height: 900,
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page
      .getByRole("button", { name: "Overtime Pay", exact: true })
      .click();
    await openGalleryActivity(page, "Explore and Learn");
    await expect(
      page.getByRole("img", {
        name: "Ordinary working day and rest day: what changes?",
      }),
    ).toBeVisible();
    await expect(page.getByText("₱250.00", { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: /Start the investigation/ }).click();
    const story = page.getByRole("region", {
      name: "Overtime explanation",
      exact: true,
    });
    await page
      .getByRole("button", { name: "Play explanation", exact: true })
      .click();
    await expect(story).toHaveAttribute("data-playing", "true");
    await page
      .getByRole("button", { name: "Pause playback", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Next moment", exact: true })
      .click();
    await expect(story).toHaveAttribute("data-moment", "1");
    await page.getByRole("button", { name: /Restart/, exact: false }).click();
    await expect(story).toHaveAttribute("data-moment", "0");
    const inspectRate = page.locator('[data-inspect="rate"]').first();
    await inspectRate.focus();
    const popup = page.getByRole("region", {
      name: "The same starting rate",
      exact: true,
    });
    await expect(popup).toBeVisible();
    await popup.getByRole("button", { name: "Keep open", exact: true }).click();
    await expect(
      popup.getByRole("button", { name: "Unpin", exact: true }),
    ).toBeVisible();
    await popup.getByRole("button", { name: "Replay", exact: false }).click();
    await page.keyboard.press("Escape");
    await expect(popup).toHaveCount(0);
    await expect(inspectRate).toBeFocused();
    await expect(story).toHaveAttribute("data-playing", "false");
    await page.screenshot({
      path: test.info().outputPath("a02-connected-explanation.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: /^Continue/ }).click();
    await expect(page.getByRole("button", { name: /^Continue/ })).toHaveCount(
      0,
    );
    await page
      .getByRole("button", {
        name: "Inspect ordinary working day",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: "Rest day", exact: true }).click();
    await page.reload();
    await page
      .getByRole("button", {
        name: "Continue unfinished activity",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("button", { name: "Rest day", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page
      .getByRole("button", { name: "Next moment", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review the relationship", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Return to the investigation", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Review the relationship",
        exact: true,
      }),
    ).toBeFocused();
    await page.getByRole("button", { name: /^Continue/ }).click();
    await page.getByRole("button", { name: /Try the comparison/ }).click();
    for (const [i, answer] of [
      "The hourly rate and overtime hours",
      "The work condition, multiplier and overtime pay",
      "1.25",
      "1.69",
      "88",
    ].entries()) {
      if (i < 2)
        await page.getByRole("radio", { name: answer, exact: true }).check();
      else {
        const input = page.locator('input[inputmode="decimal"]');
        if (i === 2) {
          await input.fill("1.");
          await expect(input).toHaveValue("1.");
        }
        if (i === 4) {
          await input.fill("80");
          await page
            .getByRole("button", { name: "Check this answer →", exact: true })
            .click();
          await expect(
            page.getByText("Look at this part again.", { exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole("button", {
              name: "Finish Explore and Learn",
              exact: true,
            }),
          ).toHaveCount(0);
        }
        await input.fill(answer);
      }
      await page
        .getByRole("button", { name: "Check this answer →", exact: true })
        .click();
      await expect(
        page.getByText("Yes—that fits.", { exact: true }),
      ).toBeVisible();
      if (i < 4)
        await page
          .getByRole("button", { name: "Next question →", exact: true })
          .click();
    }
    await page
      .getByRole("button", { name: "Check my comparison →", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "The relationship is clear.",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Finish Explore and Learn", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /Same two hours/ }),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("a02-worked-recap.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: /Replay the visual comparison/ })
      .click();
    const accessibility = await new AxeBuilder({ page }).analyze();
    expect(accessibility.violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Return to Overtime Pay", exact: true })
      .click();
    await expectGalleryActivityOffered(page, "Apply");
    await expectGalleryActivityOffered(page, "Check and Transfer");
    await page
      .getByRole("button", { name: "Review completed activity", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: /Same two hours/,
        exact: true,
      }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
