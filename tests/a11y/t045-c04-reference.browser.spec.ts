import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openC04Activity } from "../helpers/c04-gallery";
test.setTimeout(90_000);
for (const profile of ["default", "reduced", "forced", "narrow"] as const) {
  test(`production response keyboard/AX/axe ${profile}`, async ({
    page,
  }, info) => {
    if (profile === "narrow")
      await page.setViewportSize({ width: 320, height: 720 });
    await page.emulateMedia({
      reducedMotion: profile === "reduced" ? "reduce" : "no-preference",
      forcedColors: profile === "forced" ? "active" : "none",
    });
    await page.goto("/tests/fixtures/t045-c04-reference.html");
    await page
      .getByRole("button", { name: "Percentage Change", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await openC04Activity(page, "Prepare", "keyboard");
    await page.getByRole("button", { name: /Start with Maya/ }).focus();
    await page.keyboard.press("Enter");
    await page
      .getByRole("button", { name: /Share your first thinking/ })
      .focus();
    await page.keyboard.press("Enter");
    await expect(page.locator(".reference-main h2")).toBeFocused();
    for (let q = 0; q < 4; q++) {
      await page
        .getByRole("radio")
        .nth(q === 1 || q === 2 ? 1 : 0)
        .focus();
      await page.keyboard.press("Space");
      await page
        .getByRole("button", {
          name: "Share my thinking →",
          exact: true,
        })
        .focus();
      await page.keyboard.press("Enter");
      await expect(page.locator(".feedback")).toContainText(
        "Thanks for sharing your idea.",
      );
      await expect(page.locator(".feedback")).not.toContainText(
        /Confirmed|Reconsideration/,
      );
      if (q < 3) {
        await page.getByRole("button", { name: /Next question/ }).focus();
        await page.keyboard.press("Enter");
      }
    }
    await expect(page.locator(".feedback")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    await info.attach("AX-response-feedback", {
      body: await page.locator("body").ariaSnapshot(),
      contentType: "text/plain",
    });
    await page.screenshot({
      path: info.outputPath(`response-${profile}.png`),
      fullPage: true,
    });
    if (profile === "narrow") {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page.locator("html").evaluate((element) => {
        element.style.fontSize = "200%";
      });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  });
}
