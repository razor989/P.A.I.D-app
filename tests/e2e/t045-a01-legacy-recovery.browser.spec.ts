import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("unmarked legacy A01 resumes numeric evidence unchanged, finishes and continues to A02", async ({
  page,
}, info) => {
  const checkpoint = {
    schemaVersion: 1,
    studyDefinitionRevision: "PAID-STUDY-DEF-R001",
    kind: "unfinished-activity",
    checkpoint: {
      competencyId: "C04",
      activityId: "C04-A01",
      scenarioId: "C04-S01",
      position: "ACTIVE",
      responseRevision: 1,
      hasChecked: false,
      checkedResponse: null,
      checkedRevision: null,
      feedbackRevision: null,
      evaluation: null,
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "original",
            response: {
              kind: "EXACT_QUANTITY",
              value: {
                magnitude: "18000",
                kind: "MONETARY_AMOUNT",
                unit: "PHP",
                basis: "per month",
              },
            },
          },
        ],
      },
    },
  };
  await page.goto("/");
  await page.evaluate(
    (data) =>
      localStorage.setItem("paid.recovery.checkpoint.v1", JSON.stringify(data)),
    checkpoint,
  );
  await page.reload();
  const before = await page.evaluate(() =>
    localStorage.getItem("paid.recovery.checkpoint.v1"),
  );
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(page.getByText(/Resuming your saved activity/)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Anchored Change Track" }),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: /^original/ })).toHaveValue(
    "18000",
  );
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("paid.recovery.checkpoint.v1")!)
          .checkpoint.responseContract,
    ),
  ).toBeUndefined();
  expect(JSON.parse(before!).checkpoint.response.parts[0].response.kind).toBe(
    "EXACT_QUANTITY",
  );
  // Numeric evidence is not represented as four selected answers.
  for (const [role, value] of [
    ["original", "18000"],
    ["new", "18000"],
    ["difference", "0"],
  ])
    await page
      .getByRole("textbox", { name: new RegExp(`^${role}`) })
      .fill(value!);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Confirmation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish activity", exact: true }),
  ).toBeEnabled();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({
    path: info.outputPath("legacy-checked.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Finish activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Next activity", exact: true })
    .click();
  await expect(page.locator('[data-c04-track="C04-A02"]')).toBeVisible();
});
