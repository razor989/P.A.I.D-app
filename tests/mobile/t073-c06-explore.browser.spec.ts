import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * C06 Explore and Learn on touch phones (C06 batch, §H step 4). Runs in the
 * phone projects: Pixel 7 (412×915), 384×854, 360×800 and 640×360
 * landscape, all with touch.
 */
test.setTimeout(180_000);

const story = (page: Page) =>
  page.getByRole("region", { name: "Commission explanation", exact: true });

async function openExplore(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Commission", exact: true }).tap();
  await openGalleryActivity(page, "Explore and Learn", "tap");
  await page
    .getByRole("button", { name: "Investigate the two situations →" })
    .tap();
  await expect(story(page)).toBeVisible();
}

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

/** The model, the caption that explains its change and the playback controls
 * share one screen, clear of the floating lesson nav. */
async function expectMomentInView(page: Page) {
  const viewport = page.viewportSize()!;
  const nav = await page.evaluate(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      ) || 0,
  );
  const dock = await box(story(page).locator("[data-dock]"));
  const caption = await box(story(page).locator('[data-current="true"]'));
  const playback = await box(
    page.getByRole("group", { name: "Commission explanation playback" }),
  );
  expect(dock.y).toBeGreaterThanOrEqual(nav - 1);
  expect(dock.y + dock.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(caption.y).toBeGreaterThanOrEqual(nav - 1);
  // A caption that fits between the model and the bar is shown whole;
  // a longer one at least starts on screen, above the bar.
  const room =
    playback.y -
    Math.max(
      nav,
      viewport.height > viewport.width ? dock.y + dock.height : nav,
    );
  if (caption.height <= room)
    expect(caption.y + caption.height).toBeLessThanOrEqual(playback.y + 1);
  else expect(caption.y + 24).toBeLessThanOrEqual(playback.y);
  expect(playback.y + playback.height).toBeLessThanOrEqual(viewport.height + 1);
  if (viewport.height > viewport.width)
    expect(dock.height).toBeLessThanOrEqual(viewport.height * 0.45);
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}

const tap = (page: Page, name: string) =>
  page.getByRole("button", { name, exact: true }).tap();

test("every moment of all six ideas keeps the model, caption and playback on one screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExplore(page);
  for (let idea = 0; idea < 6; idea++) {
    for (let moment = 1; moment < 3; moment++) {
      await tap(page, "Next moment");
      await expect(story(page)).toHaveAttribute("data-moment", String(moment));
      await page.waitForTimeout(450);
      await expectMomentInView(page);
      // What the moment changed is marked on the model.
      await expect(
        story(page).locator(
          '[data-dock] [data-changed="true"], [data-dock][data-changed="true"]',
        ),
      ).not.toHaveCount(0);
    }
    await noHorizontalOverflow(page);
    if (idea === 3) await tap(page, "Situation B");
    await tap(page, idea === 5 ? "Explain my comparison →" : "Next idea →");
  }
  for (const name of ["Next moment", "Previous moment", "Play explanation"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      0,
    );
  expect(errors).toEqual([]);
});

test("playback controls carry spoken names, one of each", async ({ page }) => {
  await openExplore(page);
  for (const name of [
    "Previous moment",
    "Play explanation",
    "Next moment",
    "Restart",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  await expect(
    page.getByRole("slider", { name: "Explanation position" }),
  ).toHaveCount(1);
});

test("a viewport change mid-playback keeps the same model and position", async ({
  page,
}) => {
  await openExplore(page);
  const dock = story(page).locator("[data-dock]");
  await dock.evaluate((element) => {
    (element as HTMLElement & { batchMark?: boolean }).batchMark = true;
  });
  await tap(page, "Play explanation");
  await page.waitForTimeout(600);
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width, height });
  expect(
    await dock.evaluate(
      (element) =>
        (element as HTMLElement & { batchMark?: boolean }).batchMark === true,
    ),
  ).toBe(true);
  await expect(story(page)).toHaveAttribute("data-playing", "true");
});

test("reduced motion shows the finished model without animating", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openExplore(page);
  for (let moment = 1; moment < 3; moment++) {
    await tap(page, "Next moment");
    expect(
      await story(page).evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    const dock = await box(story(page).locator("[data-dock]"));
    expect(dock.y + dock.height).toBeLessThanOrEqual(
      page.viewportSize()!.height + 1,
    );
  }
});

test("Prepare keeps the workers' record, the caption and playback on one screen", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Commission", exact: true }).tap();
  await openGalleryActivity(page, "Prepare", "tap");
  await page.getByRole("button", { name: /Meet the workers/ }).tap();
  const viewport = page.viewportSize()!;
  for (let moment = 1; moment < 4; moment++) {
    await tap(page, "Next moment");
    await page.waitForTimeout(450);
    const record = await box(
      page.getByRole("region", {
        name: "The workers’ sales and agreements",
      }),
    );
    const caption = await box(page.locator('[data-current="true"]'));
    const playback = await box(
      page.getByRole("group", { name: "Sales story playback" }),
    );
    expect(record.y + record.height).toBeLessThanOrEqual(viewport.height + 1);
    expect(caption.y).toBeGreaterThanOrEqual(0);
    expect(caption.y + 24).toBeLessThanOrEqual(playback.y);
    expect(playback.y + playback.height).toBeLessThanOrEqual(
      viewport.height + 1,
    );
    if (viewport.height > viewport.width)
      expect(record.height).toBeLessThanOrEqual(viewport.height * 0.45);
  }
  await noHorizontalOverflow(page);
});

test("Apply keeps the record's givens beside the calculation", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()!.width > 767,
    "The echo is a narrow-screen aid; wide screens show the record beside the question.",
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Commission", exact: true }).tap();
  await openGalleryActivity(page, "Apply", "tap");
  await page
    .getByRole("button", { name: "Work out the agent’s commission →" })
    .tap();
  await page.getByRole("button", { name: /02.*Build the calculation/ }).tap();
  await expect(page.getByText("Sale ₱2,000,000 · rate 5%")).toBeVisible();
  await expect(page.getByLabel("Sales base (₱)")).toBeInViewport();
  await noHorizontalOverflow(page);
});

test("Transfer echoes the givens and shows the learner’s own entry in the model", async ({
  page,
}) => {
  test.skip(
    page.viewportSize()!.width > 767,
    "The echo is a narrow-screen aid; wide screens show the record beside the question.",
  );
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Commission", exact: true }).tap();
  await openGalleryActivity(page, "Check and Transfer", "tap");
  await page.getByRole("button", { name: "Read Lina’s June record →" }).tap();
  await page.getByRole("button", { name: /02.*Determine commission/ }).tap();
  await expect(page.getByText("Sales ₱120,000 × 3%")).toBeVisible();
  await page.getByLabel("Lina’s June commission (₱)").fill("3,600");
  // The learner's own entry fills its slot in the pay model (K3).
  await expect(
    page
      .getByRole("region", { name: "Lina’s June agreement and sales" })
      .getByText("₱3,600"),
  ).toHaveCount(1);
  await noHorizontalOverflow(page);
});
