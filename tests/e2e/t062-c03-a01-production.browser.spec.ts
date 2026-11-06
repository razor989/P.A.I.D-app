import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  expectGalleryActivityOffered,
  openGalleryActivity,
} from "../helpers/activity-gallery";
test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`C03-A01 production journey, recovery and completion (${reducedMotion})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await page.emulateMedia({ reducedMotion });
    await page.setViewportSize({
      width: reducedMotion === "reduce" ? 320 : 1280,
      height: 900,
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page
      .getByRole("button", { name: "Overtime Pay", exact: true })
      .click();
    await expectGalleryActivityOffered(page, "Explore and Learn");
    await expectGalleryActivityOffered(page, "Apply");
    await expectGalleryActivityOffered(page, "Check and Transfer");
    await openGalleryActivity(page, "Prepare");
    await expect(page.getByLabel("Preview boundary")).toHaveCount(0);
    await page.getByRole("button", { name: /Start with Nico/ }).click();
    await page.getByRole("button", { name: /Share my first thinking/ }).click();
    await page
      .getByRole("radio", {
        name: "I'm not sure yet; I would like to find out.",
        exact: true,
      })
      .check();
    await page.reload();
    await page
      .getByRole("button", {
        name: "Continue unfinished activity",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("radio", {
        name: "I'm not sure yet; I would like to find out.",
        exact: true,
      }),
    ).toBeChecked();
    await page.getByRole("button", { name: /Next question/ }).click();
    await page
      .getByRole("radio", {
        name: "I'm not sure yet; I would like to compare ideas.",
        exact: true,
      })
      .check();
    const a11y = await new AxeBuilder({ page }).analyze();
    expect(a11y.violations).toEqual([]);
    await page
      .getByRole("button", { name: "Record my thinking", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Finish Prepare", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Change my thinking", exact: true })
      .click();
    await expect(
      page.getByRole("radio", {
        name: "I'm not sure yet; I would like to find out.",
        exact: true,
      }),
    ).toBeChecked();
    await page
      .getByRole("radio", {
        name: "I would start with the usual pay for each hour.",
        exact: true,
      })
      .check();
    await page.getByRole("button", { name: /Next question/ }).click();
    await page
      .getByRole("button", { name: "Record my thinking", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Finish Prepare", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Return to Overtime Pay", exact: true }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Return to Overtime Pay", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Review completed activity", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Return to Overtime Pay", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Return to Overtime Pay", exact: true })
      .click();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Learning Library", exact: true }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
