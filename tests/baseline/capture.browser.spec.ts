import { test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * Visual baseline for the twelve-activity program. Captures each activity's
 * intro and first working screen at the agreed viewports, before any pilot
 * edits, so later changes can be compared side by side. Writes PNGs to
 * .tmp/baseline/<label>/ (git-ignored). Opt-in: PAID_BASELINE=<label>.
 */
const label = process.env.PAID_BASELINE;
test.skip(!label, "Set PAID_BASELINE=<label> to capture the visual baseline");
test.setTimeout(240_000);

const viewports = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "412x915", width: 412, height: 915 },
  { name: "384x854", width: 384, height: 854 },
  { name: "360x800", width: 360, height: 800 },
  { name: "320x658", width: 320, height: 658 },
  { name: "640x360", width: 640, height: 360 },
] as const;
const competencies = [
  ["c03", "Overtime Pay"],
  ["c04", "Percentage Change"],
  ["c06", "Commission"],
] as const;
const activities = [
  ["a01", "Prepare"],
  ["a02", "Explore and Learn"],
  ["a03", "Apply"],
  ["a04", "Check and Transfer"],
] as const;

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(900);
}

async function shoot(page: Page, file: string) {
  const dir = `.tmp/baseline/${label}`;
  await page.screenshot({ path: `${dir}/${file}-screen.png` });
  await page.screenshot({ path: `${dir}/${file}-full.png`, fullPage: true });
}

for (const viewport of viewports)
  for (const [cid, competency] of competencies)
    test(`baseline ${cid} at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      for (const [aid, activity] of activities) {
        await page.goto("/");
        await page.evaluate(() => localStorage.clear());
        await page.goto("/");
        await page
          .getByRole("button", { name: competency, exact: true })
          .click();
        await openGalleryActivity(page, activity);
        await settle(page);
        const base = `${cid}-${aid}-${viewport.name}`;
        await shoot(page, `${base}-1-intro`);
        const start = page
          .locator("main article button:visible")
          .filter({
            hasText:
              /→|^\s*(Start|Begin|Meet|Work on|Consider|Look at|Open|Follow)/,
          })
          .first();
        if (await start.count()) {
          await start.click();
          await settle(page);
          await shoot(page, `${base}-2-first`);
        }
        if (cid === "c03" && aid === "a02") {
          // The pilot's acceptance moment: "04 The pay" on the first stage.
          const next = page.getByRole("button", {
            name: "Next moment",
            exact: true,
          });
          for (let i = 0; i < 3 && (await next.isEnabled()); i++)
            await next.click();
          await settle(page);
          await shoot(page, `${base}-3-the-pay`);
        }
      }
    });
