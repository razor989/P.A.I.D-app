import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * C04 Prepare on touch phones (C04 batch, §H step 5). Runs in the phone
 * projects: Pixel 7 (412×915), 384×854, 360×800 and 640×360 landscape.
 */
test.setTimeout(180_000);

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

async function openStory(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .tap();
  await openGalleryActivity(page, "Prepare", "tap");
  await page.getByRole("button", { name: /Start with Maya/ }).tap();
}

test("the story heading is revealed below the lesson nav on entry", async ({
  page,
}) => {
  await openStory(page);
  const heading = page.getByRole("heading", {
    name: /What catches\s*your attention\?/,
  });
  await expect(heading).toBeFocused();
  await page.waitForTimeout(600);
  await expect(heading).toBeInViewport();
});

test("every moment keeps Maya’s documents, the caption and playback on one screen", async ({
  page,
}) => {
  await openStory(page);
  const viewport = page.viewportSize()!;
  const documents = page.locator(".employee-story [data-dock]");
  const playback = page.getByRole("group", { name: "Situation playback" });
  for (let moment = 1; moment < 6; moment++) {
    await page.getByRole("button", { name: "Next moment", exact: true }).tap();
    await expect(
      page.getByRole("button", { name: new RegExp(`^0${moment + 1} `) }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.waitForTimeout(450);
    const dock = await box(documents);
    const caption = await box(page.locator('[data-current="true"]').first());
    const bar = await box(playback);
    expect(dock.y).toBeGreaterThanOrEqual(0);
    expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(caption.y).toBeGreaterThanOrEqual(0);
    expect(caption.y + 24).toBeLessThanOrEqual(bar.y);
    expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height + 1);
    if (viewport.height > viewport.width)
      expect(dock.height).toBeLessThanOrEqual(viewport.height * 0.45);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
});
