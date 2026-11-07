import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openGalleryActivity } from "../helpers/activity-gallery";

/**
 * C06 Commission production journeys (§H step 4 safety net). Each activity
 * runs from the Library through a wrong answer, revision, the correct answer
 * and completion at desktop and narrow widths, with recovery, axe, overflow
 * and page-error checks, and screenshots of every key state.
 */
test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });

function harness(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return {
    errors,
    shot: (name: string) =>
      page.screenshot({
        path: test.info().outputPath(`${name}.png`),
        fullPage: true,
        animations: "disabled",
      }),
    noOverflow: async () =>
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true),
    axe: async () =>
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]),
  };
}

async function openCommission(page: Page, activity: string) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.goto("/");
  await page.getByRole("button", { name: "Commission", exact: true }).click();
  await openGalleryActivity(page, activity);
}

const button = (page: Page, name: string | RegExp) =>
  page.getByRole("button", {
    name,
    exact: typeof name === "string" ? true : undefined,
  });

for (const width of [1440, 320]) {
  test.describe(`C06 at ${width}px`, () => {
    test.beforeEach(async ({ page }) => {
      test.setTimeout(180_000);
      await page.setViewportSize({ width, height: 1000 });
    });

    test("A01 Prepare: story, first thinking, recovery and open closure", async ({
      page,
    }) => {
      const { errors, shot, noOverflow, axe } = harness(page);
      await openCommission(page, "Prepare");
      await shot("a01-intro");
      await noOverflow();
      await button(page, /Meet the workers/).click();
      await shot("a01-story");
      await noOverflow();
      await button(page, /Share my first thinking/).click();
      await page
        .getByRole("radio", { name: "I think their pay could be different." })
        .check();
      await page.reload();
      await button(page, /^Resume /).click();
      await expect(
        page.getByRole("radio", {
          name: "I think their pay could be different.",
        }),
      ).toBeChecked();
      await button(page, "Next question →").click();
      await page
        .getByRole("radio", {
          name: "What each worker’s pay agreement promises.",
        })
        .check();
      await axe();
      await button(page, "Record my thinking").click();
      await shot("a01-recorded");
      await button(page, "Follow both pay stories →").click();
      await shot("a01-closure");
      // Prepare ends with open questions: the pay is not worked out here.
      await expect(page.locator("main")).not.toContainText(
        /4,000|14,000|4000|14000/,
      );
      await noOverflow();
      await axe();
      await button(page, "Finish Prepare").click();
      await expect(
        page.getByText(/Carry those questions into Explore and Learn/),
      ).toBeVisible();
      await shot("a01-complete");
      expect(errors).toEqual([]);
    });

    test("A02 Explore: six moments, questions with reconsideration, completion", async ({
      page,
    }) => {
      const { errors, shot, noOverflow, axe } = harness(page);
      await openCommission(page, "Explore and Learn");
      await shot("a02-intro");
      await button(page, "Investigate the two situations →").click();
      await expect(page.getByText(/₱9,000/)).toHaveCount(0);
      for (let index = 1; index <= 6; index++) {
        await button(page, "Next moment").click();
        await shot(`a02-moment-${index}`);
        await noOverflow();
        if (index === 4) {
          await button(page, "Situation B").click();
          await button(page, "Explain this pay relationship").click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await axe();
          await button(page, "Return to this explanation").click();
        }
        await button(
          page,
          index === 6 ? "Explain my comparison →" : "Next idea →",
        ).click();
      }
      await expect(page.getByRole("radio")).toHaveCount(3);
      // A wrong choice is reconsidered without moving on.
      await page.getByRole("radio").nth(1).check();
      await button(page, "Check this answer").click();
      await expect(
        page.getByText("Let’s trace this answer together."),
      ).toBeVisible();
      await expect(button(page, "Next question →")).toHaveCount(0);
      await shot("a02-reconsider");
      await axe();
      for (const name of [
        /The salary and rate stay fixed/,
        /More sales at the same rate/,
        /Find commission from sales/,
      ]) {
        await page.getByRole("radio", { name }).check();
        await button(page, "Check this answer").click();
        await button(page, "Next question →").click();
      }
      const fields: [string, string][] = [
        ["Commission rate (%)", "3%"],
        ["Monthly base salary (₱)", "₱15,000"],
        ["Situation A commission (₱)", "9,000"],
        ["Situation A total compensation (₱)", "24,000"],
        ["Situation B commission (₱)", "15,000"],
        ["Situation B total compensation (₱)", "30,000"],
      ];
      for (const [i, [label, value]] of fields.entries()) {
        const input = page.getByLabel(label, { exact: true });
        if (i === 2) {
          await input.fill("1");
          await button(page, "Check this answer").click();
          await expect(
            page.getByText("Let’s trace this answer together."),
          ).toBeVisible();
          await shot("a02-numeric-reconsider");
          await button(page, /Help me/).click();
          await shot("a02-help");
          await button(page, "Return to this question").click();
          await expect(input).toHaveValue("1");
        }
        await input.fill(value);
        await button(page, "Check this answer").click();
        await button(
          page,
          i === 5 ? "Bring my comparison together →" : "Next question →",
        ).click();
      }
      await shot("a02-comparison");
      await noOverflow();
      await axe();
      await button(page, "Finish Explore and Learn").click();
      await expect(
        page.getByRole("region", { name: "Activity completion" }),
      ).toBeVisible();
      await shot("a02-complete");
      expect(errors).toEqual([]);
    });

    test("A03 Apply: contextual correction, help, recovery and recap", async ({
      page,
    }) => {
      const { errors, shot, noOverflow, axe } = harness(page);
      await openCommission(page, "Apply");
      await shot("a03-intro");
      await button(page, "Work out the agent’s commission →").click();
      await expect(page.getByText(/₱100,000/)).toHaveCount(0);
      await shot("a03-workspace");
      await noOverflow();
      const fill = async (sales: string, rate: string, commission: string) => {
        await button(page, /01\s*Read the agreement/).click();
        await page
          .getByRole("radio", { name: "Commission only: sales × rate." })
          .check();
        await button(page, /02.*Build the calculation/).click();
        await page.getByLabel("Sales base (₱)").fill(sales);
        await page.getByLabel("Commission rate (%)").fill(rate);
        await page.getByLabel("Agent’s commission (₱)").fill(commission);
        await button(page, /03.*Explain the payment/).click();
        await page
          .getByRole("radio", {
            name: "The agent’s commission earned from this sale.",
          })
          .check();
      };
      await fill("100,000", "5", "1");
      await button(page, "Check my commission claim").click();
      await expect(
        page.getByText(/Use the full ₱2,000,000.00 property sale/),
      ).toBeVisible();
      await shot("a03-reconsider");
      await axe();
      await button(page, "Revise my commission claim →").click();
      await button(page, "Walk me through the relationship").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await shot("a03-help");
      await button(page, "Return to my commission claim").click();
      await expect(
        button(page, "Walk me through the relationship"),
      ).toBeFocused();
      await fill("2,000,000", "5%", "100,000");
      await page.reload();
      await button(page, /^Resume /).click();
      await button(page, /02.*Build the calculation/).click();
      await expect(page.getByLabel("Sales base (₱)")).toHaveValue(
        /2,?000,?000/,
      );
      await button(page, /03.*Explain the payment/).click();
      await button(page, "Check my commission claim").click();
      await expect(
        page.getByText("Your commission claim holds together."),
      ).toBeVisible();
      await shot("a03-confirmed");
      await noOverflow();
      await button(page, "Follow the story →").click();
      await button(page, "Follow the story →").click();
      await button(page, "See my recap →").click();
      await expect(
        page.getByRole("region", { name: "Activity completion" }),
      ).toBeVisible();
      await shot("a03-recap");
      await noOverflow();
      await axe();
      expect(errors).toEqual([]);
    });

    test("A04 Transfer: reconsideration, teaching, synthesis and finale", async ({
      page,
    }) => {
      const { errors, shot, noOverflow, axe } = harness(page);
      await openCommission(page, "Check and Transfer");
      await shot("a04-intro");
      await button(page, "Read Lina’s June record →").click();
      await expect(page.locator("main")).not.toContainText(/3,600|18,600/);
      await shot("a04-workspace");
      await noOverflow();
      const fill = async (commission: string, total: string) => {
        await button(page, /01.*Read the agreement/).click();
        await page.getByRole("radio", { name: "Base-plus-commission" }).check();
        await button(page, /02.*Determine commission/).click();
        await page.getByLabel("Lina’s June commission (₱)").fill(commission);
        await button(page, /03.*Determine total pay/).click();
        await page.getByLabel("Lina’s June total compensation (₱)").fill(total);
      };
      await fill("1", "19,400");
      await button(page, "Check my June calculation").click();
      await expect(button(page, "Revise my June calculation")).toBeVisible();
      await shot("a04-reconsider");
      await axe();
      await button(page, "Revise my June calculation").click();
      await fill("3,600", "18,600");
      await button(page, "Check my June calculation").click();
      await button(page, "Follow the June pay relationship →").click();
      await expect(
        page.getByText(/Lina’s commission, ₱3,600, carries forward unchanged/),
      ).toBeVisible();
      await shot("a04-teaching");
      await button(page, "See my June recap →").click();
      await expect(
        page.getByRole("region", { name: "Your recorded June response" }),
      ).toContainText("₱18,600");
      await shot("a04-recap");
      await noOverflow();
      await button(page, "Commission: Ideas Together →").click();
      await page
        .getByRole("radio", { name: "Apply · A property sale" })
        .check();
      await button(page, "Reveal the connection").click();
      await expect(
        page.getByText(/property price supplied the sales base/),
      ).toBeVisible();
      await shot("a04-synthesis");
      await noOverflow();
      await axe();
      await button(page, "Beyond the sales record →").click();
      await button(page, "Follow the connection").click();
      await expect(page.getByText(/A sale alone cannot tell/)).toBeVisible();
      await shot("a04-finale");
      await noOverflow();
      expect(errors).toEqual([]);
    });
  });
}
