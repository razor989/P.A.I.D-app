import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

for (const mode of ["synthetic", "session", "clearing"]) {
  test(`motion-mode semantic equivalence, axe, forced colors and 320px/200%: ${mode}`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    const snapshots: string[] = [];
    for (const reducedMotion of ["no-preference", "reduce"] as const) {
      await page.emulateMedia({ reducedMotion });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.goto(
        `/tests/fixtures/t043-motion-loading.html${mode === "synthetic" ? "" : `?mode=${mode}`}`,
      );
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      if (mode === "synthetic")
        await page
          .getByRole("button", {
            name: "Start technical operation",
            exact: true,
          })
          .click();
      else if (mode === "session") {
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(
          "Learning Library",
        );
        await page.evaluate(() =>
          (window as unknown as { t043: { start(): void } }).t043.start(),
        );
      } else
        await page
          .getByRole("button", { name: "Discard unusable saved work" })
          .click();
      const loading = page.getByText(
        mode === "synthetic"
          ? "Synthetic authorized technical operation pending."
          : mode === "session"
            ? "Please wait while the current operation finishes."
            : "Clearing saved work. Please wait for storage confirmation.",
        { exact: true },
      );
      await expect(loading).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      snapshots.push(await page.locator("body").ariaSnapshot());
      expect(await page.getByRole("main").count()).toBe(1);
      await page.emulateMedia({ forcedColors: "active" });
      await page.addStyleTag({ content: ":root { font-size: 200%; }" });
      expect(
        await page.evaluate(() =>
          parseFloat(getComputedStyle(document.documentElement).fontSize),
        ),
      ).toBeGreaterThanOrEqual(32);
      await expect(loading).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      expect(
        await loading.evaluate((e) => getComputedStyle(e).fontFamily),
      ).toContain("Atkinson Hyperlegible");
      await info.attach(`${mode}-${reducedMotion}-320px-200-forced-colors`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
      await info.attach(`${mode}-${reducedMotion}-aria`, {
        body: snapshots.at(-1)!,
        contentType: "text/plain",
      });
      await page.emulateMedia({ forcedColors: "none" });
    }
    expect(snapshots[0]).toBe(snapshots[1]);
  });
}
