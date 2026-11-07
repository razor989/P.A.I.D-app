import { expect, test } from "@playwright/test";
import type { Locator, Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * C03 batch on touch phones (§H step 3, §K4): Prepare's story dock, the new
 * state and feedback placement rules in Prepare, Apply and Check and
 * Transfer, and the stale pay label on revision. Runs in the phone projects.
 */
test.setTimeout(120_000);

async function open(page: Page, activity: string) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).tap();
  await openGalleryActivity(page, activity, "tap");
}

const navOffset = (page: Page) =>
  page.evaluate(
    () =>
      parseFloat(
        getComputedStyle(document.documentElement).scrollPaddingBlockStart,
      ) || 0,
  );

async function box(locator: Locator) {
  const value = await locator.boundingBox();
  expect(value).not.toBeNull();
  return value!;
}

/** A new state or outcome is focused at its heading, which has settled on
 * screen below the floating lesson nav. */
async function expectPlaced(page: Page, heading: Locator) {
  await expect(heading).toBeFocused();
  const nav = await navOffset(page);
  const height = page.viewportSize()!.height;
  await expect(async () => {
    const value = await box(heading);
    expect(value.y).toBeGreaterThanOrEqual(nav - 2);
    expect(value.y + value.height).toBeLessThanOrEqual(height + 1);
  }).toPass({ timeout: 4000 });
}

async function noHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    ),
  ).toBeLessThanOrEqual(0);
}

test("Prepare keeps Nico's hours, the caption and playback on one screen", async ({
  page,
}) => {
  await open(page, "Prepare");
  await page.getByRole("button", { name: /Start with Nico/ }).tap();
  await noHorizontalOverflow(page);
  const surface = page.locator('[data-c03-track="C03-A01"]');
  const figure = surface.locator("[data-inspection-model] > figure");
  const playback = page.getByRole("group", { name: "Work Record playback" });
  const viewport = page.viewportSize()!;
  const nav = await navOffset(page);
  for (let moment = 1; moment <= 2; moment++) {
    await page.getByRole("button", { name: "Next moment", exact: true }).tap();
    await expect(async () => {
      const model = await box(figure);
      const caption = await box(surface.locator('[data-current="true"]'));
      const bar = await box(playback);
      expect(model.y).toBeGreaterThanOrEqual(nav - 2);
      expect(model.y + model.height).toBeLessThanOrEqual(viewport.height + 1);
      expect(caption.y).toBeGreaterThanOrEqual(nav - 2);
      expect(caption.y + caption.height).toBeLessThanOrEqual(bar.y + 1);
      expect(bar.y + bar.height).toBeLessThanOrEqual(viewport.height + 1);
      // The dock leaves room to read (§H): at most ~45% of a portrait screen.
      if (viewport.height > viewport.width)
        expect(model.height).toBeLessThanOrEqual(viewport.height * 0.45);
    }).toPass({ timeout: 4000 });
  }
  await noHorizontalOverflow(page);
  await page.getByRole("button", { name: /Share my first thinking/ }).tap();
  await page
    .getByRole("radio", {
      name: "I'm not sure yet; I would like to find out.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /Next question/ }).tap();
  await page
    .getByRole("radio", {
      name: "I'm not sure yet; I would like to compare ideas.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Record my thinking", exact: true })
    .tap();
  // §K4.1: the recorded-thinking view opens at its heading, not its foot.
  await expectPlaced(
    page,
    page.getByRole("heading", { name: /Your ideas belong/ }),
  );
});

test("Apply opens without an inspection and places each outcome", async ({
  page,
}) => {
  await open(page, "Apply");
  await page
    .getByRole("button", { name: "Open James’s work record", exact: true })
    .tap();
  // §K4.3: a resting pointer or a tap elsewhere does not open an inspection.
  await expect(page.locator('aside[role="region"]')).toHaveCount(0);
  await noHorizontalOverflow(page);
  const multiplier = page.getByRole("textbox", {
    name: "Applicable overtime multiplier",
  });
  await multiplier.fill("1.3");
  await page
    .getByRole("button", { name: "Use this multiplier", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: "What do the extra hours earn?" }),
  );
  await page
    .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
    .fill("975");
  await page
    .getByRole("button", { name: "Check my calculation", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: "Trace the reasoning again." }),
  );
  await page
    .getByRole("button", { name: "Revise my calculation", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: /Make the evidence/ }),
  );
  // §K4.7: the earlier pay is labelled as the one to recheck.
  await expect(
    page.getByText("Your last overtime pay · recheck it"),
  ).toBeVisible();
  await page.getByRole("button", { name: /01\s*Choose the multiplier/ }).tap();
  await multiplier.fill("1.25");
  await page
    .getByRole("button", { name: "Use this multiplier", exact: true })
    .tap();
  await page
    .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
    .fill("937.50");
  await page
    .getByRole("button", { name: "Check my calculation", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: "Your calculation holds together." }),
  );
  await page
    .getByRole("button", { name: "See my worked recap", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: /The condition led/ }),
  );
  await noHorizontalOverflow(page);
});

test("Check and Transfer places its reconsideration and formats the pay", async ({
  page,
}) => {
  await open(page, "Check and Transfer");
  await page
    .getByRole("button", { name: "Open Mara’s work record", exact: true })
    .tap();
  await expect(page.locator('aside[role="region"]')).toHaveCount(0);
  await page.getByRole("radio", { name: "rest day", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: "Which rule follows from that day?" }),
  );
  await page
    .getByRole("textbox", { name: "Applicable overtime multiplier" })
    .fill("1.69");
  await page.getByRole("button", { name: "Continue", exact: true }).tap();
  await page
    .getByRole("textbox", { name: "Overtime pay (₱)", exact: true })
    .fill("507");
  // §K3: the summary shows the learner's pay as pesos, not a bare number.
  await expect(
    page
      .getByRole("region", { name: "Your regular-holiday reasoning" })
      .locator("dd")
      .getByText("₱507.00", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Check my reasoning", exact: true })
    .tap();
  await expectPlaced(
    page,
    page.getByRole("heading", { name: "Take another look at the record." }),
  );
  await noHorizontalOverflow(page);
});
