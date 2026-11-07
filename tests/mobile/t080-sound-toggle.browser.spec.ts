import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * The sound switch on touch phones: Pixel 7 (412×915), 384×854, 360×800 and
 * 640×360 landscape. It must be a full touch target, overlap nothing and
 * never widen the page.
 */
test.setTimeout(120_000);

type Box = { x: number; y: number; width: number; height: number };
async function box(locator: Locator): Promise<Box> {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width - 0.5 &&
  b.x < a.x + a.width - 0.5 &&
  a.y < b.y + b.height - 0.5 &&
  b.y < a.y + a.height - 0.5;
const toggle = (page: Page) =>
  page
    .getByRole("button", { name: "Sound effects", exact: true })
    .filter({ visible: true });

async function expectClear(page: Page, scope: Locator, label: string) {
  const sound = toggle(page);
  await expect(sound).toHaveCount(1);
  const own = await box(sound);
  expect(own.width, label).toBeGreaterThanOrEqual(44);
  expect(own.height, label).toBeGreaterThanOrEqual(44);
  const viewport = page.viewportSize()!;
  expect(own.x).toBeGreaterThanOrEqual(0);
  expect(own.x + own.width).toBeLessThanOrEqual(viewport.width + 0.5);
  const others = scope.locator(
    "a:visible, button:visible:not([data-sound-toggle]), h1:visible",
  );
  for (let i = 0; i < (await others.count()); i++) {
    const other = await others.nth(i).boundingBox();
    if (other && other.width > 0)
      expect(
        overlaps(own, other),
        `${label}: overlaps ${await others.nth(i).innerText()}`,
      ).toBe(false);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("the sound switch fits the library header and the lesson nav", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Overtime Pay", exact: true }),
  ).toBeVisible();
  await expectClear(page, page.locator("header").first(), "library");
  await page.screenshot({
    path: info.outputPath("library.png"),
  });

  await page.getByRole("button", { name: "Overtime Pay", exact: true }).tap();
  await openGalleryActivity(page, "Prepare", "tap");
  await page.waitForTimeout(800);
  await expectClear(page, page.locator("[data-floating-nav]"), "lesson");
  await page.screenshot({ path: info.outputPath("lesson.png") });

  // Muting by touch persists and the switch stays put.
  const before = await box(toggle(page));
  await toggle(page).tap();
  await expect(toggle(page)).toHaveAttribute("aria-pressed", "false");
  const after = await box(toggle(page));
  expect(Math.abs(after.x - before.x)).toBeLessThan(1);

  // The island still gathers on scroll with the switch inside it.
  await page.mouse.wheel(0, 900);
  await page.evaluate(() => window.scrollBy(0, 900));
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({ path: info.outputPath("lesson-scrolled.png") });
});
