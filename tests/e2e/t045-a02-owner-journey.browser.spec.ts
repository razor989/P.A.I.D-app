import { expect, test } from "@playwright/test";
import {
  enterReference,
  readToPractice,
} from "../helpers/c04-reference-journey";
import { openC04Activity } from "../helpers/c04-gallery";

test.setTimeout(90_000);

test("wrong primary, reconsideration, formative ordering, partial recap, review and authentic continuation", async ({
  page,
}, info) => {
  await page.goto("/");
  await enterReference(page);
  await readToPractice(page);
  await expect(page.locator('[data-action="primary-next"]')).toHaveCount(0);
  await page.getByRole("radio").nth(1).check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.locator("#feedback")).toContainText("Take another look");
  await expect(page.locator('[data-action="primary-next"]')).toHaveCount(0);
  await expect(page.locator('[data-action="primary-finish"]')).toBeEnabled();
  await page.getByRole("button", { name: "Reconsider my selection" }).click();
  await expect(page.getByRole("radio").first()).toBeEnabled();
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.locator("#feedback")).toContainText("That reasoning fits");
  await expect(
    page.getByRole("heading", {
      name: "What changes when we change the scale?",
    }),
  ).toBeVisible();
  await expect(page.locator(".q1-laboratory")).toContainText(
    "Keep the gold additions fixed",
  );
  await expect(page.locator('[data-action="primary-next"]')).toBeEnabled();
  await expect(page.locator(".q1-pair")).toBeHidden();
  await page.locator('[data-q1-reason="difference"]').click();
  await page.locator('[data-q1-mode="shares"]').click();
  await expect(
    page.locator('[data-q1-mode="shares"][aria-pressed="true"]'),
  ).toHaveText("Compare shares of the original");
  await expect(page.locator("#feedback")).toBeVisible();
  await page.locator('[data-q1-mode="pesos"]').click();
  await expect(
    page.locator('[data-q1-mode="pesos"][aria-pressed="true"]'),
  ).toHaveText("Compare pesos");
  await page.locator('[data-action="primary-finish"]').click();
  await expect(page.locator(".completion")).toContainText("question 1 of 3");
  await expect(page.locator(".completion")).not.toContainText(
    "Completion alone does not show independent mastery",
  );
  await page.getByRole("button", { name: "Revisit the explanation" }).click();
  await expect(page.locator(".lesson-heading h2")).toBeFocused();
  await page.getByRole("button", { name: "Replay the relationship" }).click();
  await expect(page.locator(".workbench")).toBeVisible();
  await page.getByRole("button", { name: "Return to completion" }).click();
  await expect(page.locator(".completion h2")).toBeFocused();
  await info.attach("partial-recap-AX", {
    body: await page.locator("body").ariaSnapshot(),
    contentType: "text/plain",
  });
  await page.screenshot({
    path: info.outputPath("partial-recap.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Continue completed activity", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Apply");
});

test("wrong-outcome early Finish does not imply all three questions or mastery", async ({
  page,
}) => {
  await page.goto("/");
  await enterReference(page);
  await readToPractice(page);
  await page.getByRole("radio").last().check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await expect(page.locator("#feedback")).toContainText("Take another look");
  await expect(page.locator('[data-action="primary-next"]')).toHaveCount(0);
  await page.locator('[data-action="primary-finish"]').click();
  await expect(page.locator(".completion")).toContainText("question 1 of 3");
  await page
    .getByRole("button", {
      name: "Return to the Learning Library",
      exact: true,
    })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
});

test("real browser checkpoint reload, departure and re-entry retain genuine A02 progress", async ({
  page,
}) => {
  await page.goto("/");
  await enterReference(page);
  await readToPractice(page);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check my reasoning" }).click();
  await page.locator('[data-action="primary-next"]').click();
  await expect(page.locator(".practice-count")).toContainText("2 of 3");
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("paid.recovery.checkpoint.v1")),
    )
    .not.toBeNull();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(page.locator(".practice-count")).toContainText("2 of 3");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Percentage Change",
  );
  await openC04Activity(page, "Explore and Learn");
  await expect(page.locator(".practice-count")).toContainText("2 of 3");
  await expect(page.getByRole("radio", { checked: true })).toHaveCount(0);
});

test("Recovery storage failure retries honestly and malformed checkpoint requires explicit discard", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.getItem;
    let reads = 0;
    Storage.prototype.getItem = function (key) {
      if (reads++ < 2 && key === "paid.recovery.checkpoint.v1") {
        throw new Error("intentional browser recovery read failure");
      }
      return original.call(this, key);
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "storage is unavailable",
  );
  await page.getByRole("button", { name: "Retry storage read" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
  await page.evaluate(() =>
    localStorage.setItem("paid.recovery.checkpoint.v1", "{"),
  );
  await page.reload();
  await page.getByRole("button", { name: "Retry storage read" }).click();
  await expect(page.getByRole("status")).toContainText("could not be restored");
  await page
    .getByRole("button", { name: "Discard unusable saved work" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem("paid.recovery.checkpoint.v1"),
    ),
  ).toBeNull();
});

test("touch narrow-screen guided selection and reduced-motion replay remain operable", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 320, height: 900 },
    hasTouch: true,
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4179/");
  await enterReference(page);
  await readToPractice(page);
  await page.getByRole("radio").first().tap();
  await page.getByRole("button", { name: "Check my reasoning" }).tap();
  await expect(page.locator("#feedback")).toContainText("That reasoning fits");
  await expect(page.locator('[data-action="primary-next"]')).toBeEnabled();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await context.close();
});
