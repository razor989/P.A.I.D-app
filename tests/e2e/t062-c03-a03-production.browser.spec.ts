import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });

for (const width of [1440, 320]) {
  test(`A03 independent production calculation at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page
      .getByRole("button", { name: "Overtime Pay", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check and Transfer", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Apply", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: /Extra hours\.\s*Your calculation\./ }),
    ).toBeVisible();
    await expect(page.getByText("₱937.50", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("a03-landing.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Open James’s work record", exact: true })
      .click();
    await page.locator('button[data-inspect="hours"]').click();
    await expect(
      page.getByText(/Each mark stands for one overtime hour/),
    ).toBeVisible();
    const inspection = page.getByRole("region", {
      name: "Count the extra hours together",
    });
    await expect(inspection).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await inspection.getByRole("button", { name: "Close inspection" }).click();
    await expect(page.locator('button[data-inspect="hours"]')).toBeFocused();
    await expect(inspection).toHaveCount(0);
    const documentTop = () =>
      page
        .locator('[data-inspect="pay"]')
        .evaluate((element) => element.getBoundingClientRect().top + scrollY);
    const before = await documentTop();
    await page.locator('[data-inspect="condition"]').focus();
    const dayInspection = page.getByRole("region", {
      name: "The day chooses the rule",
    });
    await expect(dayInspection).toBeVisible();
    await expect(dayInspection).not.toContainText("1.25");
    const after = await documentTop();
    expect(after).toBe(before);
    await page.keyboard.press("Escape");
    await expect(dayInspection).toHaveCount(0);
    await page.locator('[data-inspect="rate"]').click();
    const rateInspection = page.getByRole("region", {
      name: "Start with one hour",
    });
    await rateInspection
      .getByRole("button", { name: "Unpin", exact: true })
      .click();
    await rateInspection
      .getByRole("button", { name: "Keep open", exact: true })
      .click();
    await page.keyboard.press("Escape");
    await expect(rateInspection).toHaveCount(0);
    const multiplier = page.getByRole("textbox", {
      name: "Applicable overtime multiplier",
      exact: true,
    });
    await multiplier.fill("1.");
    await expect(multiplier).toHaveValue("1.");
    await multiplier.fill("1.25");
    await page
      .getByRole("button", { name: "Use this multiplier", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
      .fill("938");
    await page.reload();
    await page
      .getByRole("button", {
        name: "Continue unfinished activity",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("textbox", {
        name: "Applicable overtime multiplier",
        exact: true,
      }),
    ).toHaveValue("1.25");
    await page.getByRole("button", { name: /02\s*Calculate the pay/ }).click();
    await expect(
      page.getByRole("textbox", { name: "Overtime pay (₱)", exact: true }),
    ).toHaveValue("938");
    await page
      .getByRole("button", { name: "Review the relationship", exact: true })
      .click();
    await expect(
      page.getByRole("region", {
        name: "Review the overtime relationship",
        exact: true,
      }),
    ).toBeFocused();
    await expect(page.getByText("₱937.50", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Return to my calculation", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Review the relationship",
        exact: true,
      }),
    ).toBeFocused();
    await page
      .getByRole("button", { name: "Check my calculation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Trace the reasoning again.",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "See my worked recap", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText("₱937.50", { exact: true })).toHaveCount(0);
    await page
      .getByRole("button", { name: "Revise my calculation", exact: true })
      .click();
    await page
      .getByRole("button", { name: /01\s*Choose the multiplier/ })
      .click();
    await page
      .getByRole("textbox", { name: "Applicable overtime multiplier" })
      .fill("1.3");
    await page
      .getByRole("button", { name: "Use this multiplier", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
      .fill("939");
    await page
      .getByRole("button", { name: "Check my calculation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Go back to the kind of day." }),
    ).toBeVisible();
    await expect(page.getByText("₱937.50", { exact: true })).toHaveCount(0);
    await page.screenshot({
      path: test.info().outputPath("a03-reconsideration.png"),
      animations: "disabled",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Revise my calculation", exact: true })
      .click();
    await page
      .getByRole("button", { name: /01\s*Choose the multiplier/ })
      .click();
    await page
      .getByRole("textbox", { name: "Applicable overtime multiplier" })
      .fill("1.25");
    await page
      .getByRole("button", { name: "Use this multiplier", exact: true })
      .click();
    await page
      .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
      .fill("937.50");
    await page.screenshot({
      path: test.info().outputPath("a03-workspace.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "Check my calculation", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Your calculation holds together.",
        exact: true,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "See my worked recap", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /The condition led/ }),
    ).toBeVisible();
    await expect(page.getByText("₱937.50", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Revisit James’s work record" })
      .click();
    await expect(
      page.getByRole("region", { name: "James’s monthly work record" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close the work record" }).click();
    await page.screenshot({
      path: test.info().outputPath("a03-recap.png"),
      animations: "disabled",
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole("button", { name: "Return to Overtime Pay", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check and Transfer", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Review completed activity", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: /The condition led/ }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}
