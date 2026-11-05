import { expect, test } from "@playwright/test";
import { openC04Activity } from "../helpers/c04-gallery";

test("Session destinations, real keyboard skip, guarded availability and Back survive responsive reflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  // The Library lists the offered competencies only; catalog-only
  // competencies remain Session destinations but are not learner-facing here.
  await expect(
    page.getByRole("list", { name: "Competencies" }).getByRole("button"),
  ).toHaveText(["Overtime Pay", "Percentage Change", "Commission"]);
  await expect(
    page.getByRole("button", { name: "Gross Income", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await openC04Activity(page, "Explore and Learn");
  await expect(page).toHaveTitle(
    "P.A.I.D. — Percentage Change — Explore and Learn",
  );
  await expect(
    page.getByRole("heading", { level: 2, name: "Making sense of a raise" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Percentage Change",
  );
  await page
    .getByRole("button", { name: "Learning Library", exact: true })
    .click();
  await expect(page).toHaveTitle("P.A.I.D. — Learning Library");
  for (const width of [320, 640, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  expect(
    await page
      .locator("[tabindex]")
      .evaluateAll((els) =>
        els.every((e) => Number(e.getAttribute("tabindex")) <= 0),
      ),
  ).toBe(true);
});
