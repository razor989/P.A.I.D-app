import { expect, test } from "@playwright/test";
test("explicit v3 retains aggregate grading and its original optional post-Check playback without conversion", async ({
  page,
}) => {
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
      responseContract: { id: "C04-A01-guided-prepare-v3", version: 3 },
      response: {
        kind: "COMPOSITE",
        parts: [
          {
            key: "original",
            response: {
              kind: "SINGLE_SELECTION",
              selectionId: "c04-a01-v3-original-before",
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
  await page.getByRole("button", { name: /^Resume / }).click();
  for (let q = 0; q < 4; q++) {
    await page
      .getByRole("radio")
      .nth(q === 1 || q === 2 ? 1 : 0)
      .check();
    await page
      .getByRole("button", {
        name: q === 3 ? "Review my choices" : "Next question",
        exact: true,
      })
      .click();
  }
  await page
    .getByRole("button", { name: "Check my reasoning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your answer holds", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Finish activity", exact: true }),
  ).toBeEnabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("paid.recovery.checkpoint.v1")!),
  );
  expect(saved.checkpoint.responseContract).toEqual({
    id: "C04-A01-guided-prepare-v3",
    version: 3,
  });
  expect(saved.checkpoint.guidedPractice).toBeUndefined();
});
