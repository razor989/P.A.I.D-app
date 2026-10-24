import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("production keyboard, AX, axe, 320px/200%, forced-colors and motion equivalence", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  const snapshots: string[] = [];
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion, forcedColors: "none" });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/tests/fixtures/t044-c04-anchored-track.html");
    await page
      .getByRole("button", { name: "Percentage Change", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Explore and Learn", exact: true })
      .click();
    const track = page.locator("[data-c04-track]");
    for (let i = 0; i < 3; i++)
      await track
        .getByRole("button", { name: "Continue", exact: true })
        .click();
    const choice = track.getByRole("group").getByRole("button");
    await choice.focus();
    await page.keyboard.press("Space");
    await expect(choice).toBeFocused();
    await expect(choice).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Tab");
    await expect(
      track.getByRole("button", { name: "Previous", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(choice).toBeFocused();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    snapshots.push(await track.ariaSnapshot());
    await page.addStyleTag({ content: ":root { font-size: 200%; }" });
    await page.emulateMedia({ forcedColors: "active" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(choice).toBeVisible();
    await expect(track.locator("svg")).toHaveAttribute("aria-hidden", "true");
    expect(
      await choice.evaluate((el) => getComputedStyle(el).outlineStyle),
    ).not.toBe("none");
    await page.screenshot({
      path: info.outputPath(`${reducedMotion}-320-200-forced.png`),
      fullPage: true,
    });
    await info.attach(`${reducedMotion}-AX`, {
      body: await track.ariaSnapshot(),
      contentType: "text/plain",
    });
  }
  expect(snapshots[0]).toBe(snapshots[1]);
});
