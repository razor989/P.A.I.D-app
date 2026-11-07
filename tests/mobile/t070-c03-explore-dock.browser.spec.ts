import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * C03 Explore and Learn on touch phones (pilot acceptance, §H/§I).
 * Runs in the phone projects: Pixel 7 (412×915), 384×854, 360×800 and
 * 640×360 landscape, all with touch.
 */
test.setTimeout(120_000);

async function openExplore(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).tap();
  await openGalleryActivity(page, "Explore and Learn", "tap");
  await page.getByRole("button", { name: /Start the investigation/ }).tap();
  await expect(story(page)).toBeVisible();
}

const story = (page: Page) =>
  page.getByRole("region", { name: "Overtime explanation", exact: true });

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

/** The changed model, the caption that explains it and the playback controls
 * are on one screen, clear of the floating lesson nav. */
async function expectMomentInView(page: Page) {
  const viewport = page.viewportSize()!;
  const nav = await page.evaluate(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      ) || 0,
  );
  const dock = await box(story(page).locator("[data-cue]"));
  const scene = await box(
    story(page).locator("[data-cue] svg").filter({ visible: true }).first(),
  );
  const caption = await box(story(page).locator('[data-current="true"]'));
  const playback = await box(
    page.getByRole("group", { name: "Overtime explanation playback" }),
  );
  expect(scene.y).toBeGreaterThanOrEqual(nav - 1);
  expect(scene.y + scene.height).toBeLessThanOrEqual(viewport.height + 1);
  expect(caption.y).toBeGreaterThanOrEqual(nav - 1);
  expect(caption.y + caption.height).toBeLessThanOrEqual(playback.y + 1);
  expect(playback.y + playback.height).toBeLessThanOrEqual(viewport.height + 1);
  // The dock leaves room to read: at most ~45% of the screen (§H).
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

async function nextMoment(page: Page) {
  await page.getByRole("button", { name: "Next moment", exact: true }).tap();
}

test("every moment keeps the model, its caption and playback on one screen", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openExplore(page);
  await noHorizontalOverflow(page);
  const moments = Number(
    await story(page)
      .getByRole("navigation", { name: "Explanation moments" })
      .getAttribute("data-count"),
  );
  for (let moment = 1; moment < moments; moment++) {
    await nextMoment(page);
    await expect(story(page)).toHaveAttribute("data-moment", String(moment));
    await page.waitForTimeout(450);
    await expectMomentInView(page);
  }
  // Stage 2 → 3: open the ordinary-day record, continue to the rest day.
  await page.getByRole("button", { name: "Continue →", exact: true }).tap();
  await page
    .getByRole("button", { name: /Inspect ordinary working day/ })
    .tap();
  await page.getByRole("button", { name: "Continue →", exact: true }).tap();
  await expect(
    page.getByRole("heading", { name: "What changes on a rest day?" }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Rest day", exact: true }).tap();
  for (let moment = 1; moment <= 3; moment++) {
    await nextMoment(page);
    await page.waitForTimeout(450);
    await expectMomentInView(page);
  }
  // "The pay": the bars, the caption and playback in one screen.
  await expect(story(page).locator('[data-current="true"]')).toContainText(
    "₱338",
  );
  await page.screenshot({
    path: `.tmp/pilot/${test.info().project.name}-rest-day-the-pay.png`,
  });
  await noHorizontalOverflow(page);
  for (const name of ["Next moment", "Previous moment", "Play explanation"])
    await expect(page.getByRole("button", { name, exact: true })).toHaveCount(
      1,
    );
  expect(errors).toEqual([]);
});

test("the caption says which day it describes when the other day is shown", async ({
  page,
}) => {
  await openExplore(page);
  await page.getByRole("button", { name: "Continue →", exact: true }).tap();
  await page
    .getByRole("button", { name: /Inspect ordinary working day/ })
    .tap();
  await page.getByRole("button", { name: "Continue →", exact: true }).tap();
  await page.getByRole("button", { name: "Rest day", exact: true }).tap();
  for (let moment = 1; moment <= 3; moment++) await nextMoment(page);
  await page
    .getByRole("button", { name: "Ordinary working day", exact: true })
    .tap();
  await expect(
    page.getByText("These lines follow the rest day."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Show the rest day" }).tap();
  await expect(page.getByText("These lines follow the rest day.")).toHaveCount(
    0,
  );
});

test("a viewport change mid-playback keeps the same model and position", async ({
  page,
}) => {
  await openExplore(page);
  const dock = story(page).locator("[data-cue]");
  await dock.evaluate((element) => {
    (element as HTMLElement & { pilotMark?: boolean }).pilotMark = true;
  });
  await page
    .getByRole("button", { name: "Play explanation", exact: true })
    .tap();
  await page.waitForTimeout(600);
  const { width, height } = page.viewportSize()!;
  await page.setViewportSize({ width: height, height: width });
  await page.waitForTimeout(300);
  await page.setViewportSize({ width, height });
  expect(
    await dock.evaluate(
      (element) =>
        (element as HTMLElement & { pilotMark?: boolean }).pilotMark === true,
    ),
  ).toBe(true);
  await expect(story(page)).toHaveAttribute("data-playing", "true");
});

test("reduced motion shows each moment's end state without animating", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await openExplore(page);
  for (let moment = 1; moment <= 3; moment++) {
    await nextMoment(page);
    expect(
      await story(page).evaluate(
        (element) =>
          element
            .getAnimations({ subtree: true })
            .filter((animation) => animation.playState === "running").length,
      ),
    ).toBe(0);
    await expectMomentInView(page);
  }
});

test("leaving mid-explanation and resuming returns to the same stage", async ({
  page,
}) => {
  await openExplore(page);
  await page.getByRole("button", { name: "Continue →", exact: true }).tap();
  const heading = page.getByRole("heading", {
    name: "How is an ordinary-day hour paid?",
  });
  await expect(heading).toBeVisible();
  await page
    .getByRole("button", { name: "Return to Learning Library", exact: true })
    .tap();
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).tap();
  await openGalleryActivity(page, "Explore and Learn", "tap");
  await expect(heading).toBeVisible();
});
