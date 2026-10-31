import { expect, test } from "@playwright/test";
import { readToPractice } from "../helpers/c04-reference-journey";
import type { Page } from "@playwright/test";
test.setTimeout(90_000);
async function open(page: Page, label: string) {
  await page.goto("/tests/fixtures/t045-c04-reference.html");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page.getByRole("button", { name: label, exact: true }).click();
  if (label === "Prepare") {
    await page.getByRole("button", { name: /Start with Maya/ }).click();
    await page.getByRole("button", { name: /Make your comparison/ }).click();
  } else if (label === "Apply")
    await page.getByRole("button", { name: /Work on the offer/ }).click();
  else
    await page.getByRole("button", { name: "Continue", exact: true }).click();
}

async function choosePrepare(page: Page, correct = true) {
  for (let q = 0; q < 4; q++) {
    await page
      .getByRole("radio")
      .nth(q === 1 || q === 2 ? 1 : q === 3 && !correct ? 1 : 0)
      .check();
    await page
      .getByRole("button", {
        name: q === 3 ? "Review my choices" : "Next question",
        exact: true,
      })
      .click();
  }
}
async function fill(page: Page, fields: Record<string, string>) {
  for (const [role, value] of Object.entries(fields))
    await page
      .getByRole("textbox", {
        name: new RegExp(`^${role}(?: —| \\(optional\\))`),
      })
      .fill(value);
}
for (const [label, id, values] of [
  ["Prepare", "C04-A01", { original: "18000", new: "18000", difference: "0" }],
  [
    "Apply",
    "C04-A03",
    { original: "30000", new: "27000", difference: "-3000", percentage: "-10" },
  ],
] as const) {
  test(`${id} correct response, real receipt and durable completion`, async ({
    page,
  }, info) => {
    await open(page, label);
    await expect(page.locator("[data-feedback]")).toHaveCount(0);
    if (id === "C04-A01") await choosePrepare(page);
    else {
      for (const [role, value] of Object.entries(values)) {
        if (role === "difference")
          await page
            .getByRole("button", { name: /Work out the change →/ })
            .click();
        const labels: Record<string, string> = {
          original: "Original salary",
          new: "New salary",
          difference: "Signed difference",
          percentage: "Percentage change",
        };
        await page
          .getByRole("textbox", { name: new RegExp(`^${labels[role]}`) })
          .fill(value);
      }
      await page
        .getByRole("button", { name: /State your conclusion →/ })
        .click();
      await page
        .getByRole("group", { name: "Interpretation of the offer" })
        .getByRole("button")
        .first()
        .click();
    }
    await page
      .getByRole("button", {
        name: id === "C04-A01" ? "Check my reasoning" : "Check",
        exact: true,
      })
      .click();
    await expect(page.locator("[data-feedback]")).toContainText("Confirmed");
    await expect(
      page.getByRole("button", {
        name: id === "C04-A03" ? "See your recap →" : "Finish activity",
      }),
    ).toBeEnabled();
    const receipts = await page.evaluate(
      () =>
        (
          window as unknown as {
            t045: { inspect(): { receipts: { visible: boolean }[] } };
          }
        ).t045.inspect().receipts,
    );
    expect(receipts.length).toBe(1);
    expect(receipts.every((receipt) => receipt.visible)).toBe(true);
    await page.screenshot({
      path: info.outputPath(`${id}-feedback.png`),
      fullPage: true,
    });
    await info.attach("AX-feedback", {
      body: await page.locator("body").ariaSnapshot(),
      contentType: "text/plain",
    });
    await page
      .getByRole("button", {
        name: id === "C04-A03" ? "See your recap →" : "Finish activity",
      })
      .click();
    if (id === "C04-A01")
      await expect(
        page.getByRole("heading", { name: "Same amounts. Distinct roles." }),
      ).toBeVisible();
    else
      await expect(
        page.getByRole("heading", {
          name: "The offer, in perspective.",
          exact: true,
        }),
      ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as unknown as { t045: { inspect(): { clears: number } } }
            ).t045.inspect().clears,
        ),
      )
      .toBeGreaterThan(0);
    await page.getByRole("button", { name: "Next activity" }).click();
    if (id === "C04-A01")
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: "Making sense of a raise",
        }),
      ).toBeVisible();
    else
      await expect(
        page.getByText("Stage: ENTRY", { exact: true }),
      ).toBeVisible();
  });
}
test("A01 reconsideration, revision, technical barrier, modal and fresh reentry", async ({
  page,
}) => {
  await open(page, "Prepare");
  await choosePrepare(page, false);
  await page
    .getByRole("button", { name: "Check my reasoning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reconsideration", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Revise response" }).click();
  await expect(page.getByRole("radio").first()).toBeChecked();
  await page.getByRole("button", { name: "Review", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Review", exact: true }),
  ).toBeFocused();
  await page.evaluate(() =>
    (window as unknown as { t045: { block(): void } }).t045.block(),
  );
  await expect(page.getByRole("radio").first()).toBeDisabled();
  await page.evaluate(() =>
    (window as unknown as { t045: { unblock(): void } }).t045.unblock(),
  );
  await choosePrepare(page);
  await page
    .getByRole("button", { name: "Check my reasoning", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirmation", exact: true }),
  ).toBeVisible();
});
test("A02 reference teaching and three guided selections retain receipts and Session continuation", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/t045-c04-reference.html");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore and Learn", exact: true })
    .click();
  await readToPractice(page);
  for (let q = 0; q < 3; q++) {
    await expect(page.getByRole("radio")).toHaveCount(3);
    await page.getByRole("radio").nth(q).check();
    await page.getByRole("button", { name: "Check my reasoning" }).click();
    await expect(page.locator("#feedback[data-content-id]")).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const c = (
            window as unknown as {
              t045: {
                inspect(): {
                  feedbackRevision: number;
                  responseRevision: number;
                };
              };
            }
          ).t045.inspect();
          return c.feedbackRevision === c.responseRevision;
        }),
      )
      .toBe(true);
    if (q === 0) await page.locator('[data-q1-reason="difference"]').click();
    await page
      .locator(
        q === 0
          ? '[data-q1-mode="shares"]'
          : q === 1
            ? '[data-q2-choice="own"]'
            : '[data-q3-choice="smaller"]',
      )
      .first()
      .click();
    await expect(page.locator("#feedback[data-content-id]")).toBeVisible();
    await page
      .getByRole("button", {
        name: q < 2 ? "Next idea" : "See your recap",
        exact: false,
      })
      .click();
  }
  await expect(page.locator(".completion")).toContainText("question 3 of 3");
  await expect(page.locator(".completion")).not.toContainText(
    "Completion alone does not show independent mastery",
  );
  await page
    .getByRole("button", { name: "Continue completed activity", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Apply");
});
for (const wrong of [false, true])
  test(`A04 staged commitment and independent terminal receipt wrong=${wrong}`, async ({
    page,
  }, info) => {
    await open(page, "Check and Transfer");
    await expect(page.getByRole("radio")).toHaveCount(0);
    await fill(page, { difference: wrong ? "0" : "1500" });
    await page.getByRole("checkbox", { name: "percentage: UNDEFINED" }).check();
    await page.getByRole("button", { name: "Commit primary response" }).click();
    await expect(page.getByRole("radio")).toHaveCount(2);
    await page.getByRole("button", { name: "Return to primary" }).click();
    await expect(page.getByRole("radio")).toHaveCount(0);
    await fill(page, { difference: wrong ? "0" : "1500" });
    await page.getByRole("checkbox", { name: "percentage: UNDEFINED" }).check();
    await page.getByRole("button", { name: "Commit primary response" }).click();
    await page
      .getByRole("radio")
      .nth(wrong ? 1 : 0)
      .check();
    await page.getByRole("button", { name: "Check", exact: true }).click();
    await expect(
      page.getByText(`Stage: ${wrong ? "RECONSIDERATION" : "CONFIRMATION"}`, {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("[data-terminal]")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Finish activity" }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(page.locator("[data-terminal]")).toContainText(/undefined/i);
    const receipts = await page.evaluate(
      () =>
        (
          window as unknown as {
            t045: {
              inspect(): { receipts: { type: string; visible: boolean }[] };
            };
          }
        ).t045.inspect().receipts,
    );
    expect(receipts.map((receipt) => receipt.type)).toEqual([
      "FEEDBACK_DELIVERED",
      "TERMINAL_TEACHING_DELIVERED",
    ]);
    expect(receipts.every((receipt) => receipt.visible)).toBe(true);
    await page.screenshot({
      path: info.outputPath("A04-terminal.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Finish activity" }).click();
    await expect(
      page.getByRole("heading", {
        name: "The offer, in perspective.",
        exact: true,
      }),
    ).toBeVisible();
  });
