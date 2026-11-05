import { expect, test } from "@playwright/test";
import { enterReference, readingBeats } from "../helpers/c04-reference-journey";
import { openC04Activity } from "../helpers/c04-gallery";

test.setTimeout(90_000);

test("real production destination, five stages, fixed selections and barriers", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/t044-c04-anchored-track.html");
  await enterReference(page);
  const track = page.locator("[data-c04-track]");
  await expect(track).toHaveAttribute("data-c04-track", "C04-A02");
  for (let i = 0; i < readingBeats.length; i++) {
    if (i === 3 || i === 8) {
      await expect(track.locator(".raise-block")).toHaveCount(0);
      await expect(track).not.toContainText(i === 3 ? "10%" : "20%");
      const engage = track.locator('[data-action="engage"]');
      await engage.focus();
      await page.keyboard.press(i === 3 ? "Enter" : "Space");
      if (i === 3) {
        await expect(track.locator(".employee-story")).toBeVisible();
        await expect(track.locator(".story-added")).toBeHidden();
        await track.locator('button[data-moment="1"]').click();
      }
      await expect(track.locator(".raise-block")).toHaveCount(1);
    } else
      await page
        .getByRole("button", { name: readingBeats[i]!, exact: false })
        .click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
    if (i === 6) await expect(track).toContainText("10%");
    if (i === 14) {
      await expect(track).toContainText("10%");
      await expect(track).toContainText("20%");
    }
    if (i < readingBeats.length - 1)
      await expect(page.getByRole("radio")).toHaveCount(0);
  }
  await expect(page.getByRole("radio")).toHaveCount(3);
  await track.locator('[data-action="inspect"][data-id="B"]').click();
  await expect(track.locator(".salary-model").first()).toContainText("10,000");
  await page.evaluate(() =>
    (window as unknown as { t044: { block(): void } }).t044.block(),
  );
  await expect(track.locator('[data-action="inspect"]').first()).toBeDisabled();
  await page.evaluate(() =>
    (window as unknown as { t044: { unblock(): void } }).t044.unblock(),
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(track).toHaveCount(0);
  await openC04Activity(page, "Explore and Learn");
  await expect(page.getByRole("radio")).toHaveCount(3);
  expect(
    await page.evaluate(() =>
      (window as unknown as { t044: { phase(): string } }).t044.phase(),
    ),
  ).toBe("ACTIVE");
  await info.attach("production-AX", {
    body: await page.locator("body").ariaSnapshot(),
    contentType: "text/plain",
  });
  await page.screenshot({
    path: info.outputPath("production-c04.png"),
    fullPage: true,
  });
});

for (const [label, id] of [
  ["Prepare", "C04-A01"],
  ["Apply", "C04-A03"],
  ["Check and Transfer", "C04-A04"],
]) {
  test(`${id} static production profile keeps early answers withheld`, async ({
    page,
  }) => {
    await page.goto("/tests/fixtures/t044-c04-anchored-track.html");
    await page
      .getByRole("button", { name: "Percentage Change", exact: true })
      .click();
    await openC04Activity(page, label);
    const track = page.locator("[data-c04-track]");
    await expect(track).toHaveAttribute("data-c04-track", id!);
    if (id === "C04-A01")
      await expect(
        track.getByRole("button", { name: /Start with Maya/ }),
      ).toBeVisible();
    else if (id === "C04-A03") {
      await expect(
        track.getByRole("heading", { name: "An offer, revised.", exact: true }),
      ).toBeVisible();
      await expect(track.getByRole("figure")).toBeVisible();
      await expect(
        track.getByRole("button", { name: /Work on the offer/ }),
      ).toBeVisible();
      // Given source documents are permitted; proportional derived geometry is not.
      await expect(track.getByRole("figure")).toHaveCount(1);
      await expect(
        track.getByRole("group", {
          name: "One position. Two monthly salary offers.",
        }),
      ).toBeVisible();
      await expect(
        track.locator("[data-feedback],[data-terminal]"),
      ).toHaveCount(0);
      expect(await track.innerHTML()).not.toMatch(/-3000|−3,000|−10%|-10%/);
    } else {
      await expect(
        track.getByRole("heading", {
          name: "Something new. A different start.",
        }),
      ).toBeVisible();
      await expect(
        track.getByRole("button", { name: "Consider the allowance →" }),
      ).toBeEnabled();
      expect(await track.innerHTML()).not.toMatch(
        /division by zero|formula requires division|percentage is undefined|data-terminal/,
      );
    }
    await expect(track.getByRole("radio")).toHaveCount(0);
    await expect(track.getByRole("textbox")).toHaveCount(0);
    await expect(track).not.toContainText("UNDEFINED — NO PERCENTAGE REPORTED");
    await expect(track).not.toContainText("-10%");
  });
}
