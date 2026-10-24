import { expect, test } from "@playwright/test";

test.setTimeout(90_000);

test("real production destination, five stages, fixed selections and barriers", async ({
  page,
}, info) => {
  await page.goto("/tests/fixtures/t044-c04-anchored-track.html");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore and Learn", exact: true })
    .click();
  const track = page.locator("[data-c04-track]");
  await expect(track).toHaveAttribute("data-c04-track", "C04-A02");
  await expect(track.getByText("Stage: ENTRY", { exact: true })).toBeVisible();
  for (const stage of ["EXP-01", "EXP-02", "EXP-03", "EXP-04", "EXP-05"]) {
    await track.getByRole("button", { name: "Continue", exact: true }).click();
    await expect(
      track.getByText(`Stage: ${stage}`, { exact: true }),
    ).toBeVisible();
    if (stage === "EXP-01")
      await expect(track.getByRole("group")).toHaveCount(0);
    if (stage === "EXP-02" || stage === "EXP-03") {
      const options = track.getByRole("group").getByRole("button");
      await expect(options).toHaveCount(1);
      await options.first().focus();
      await page.keyboard.press(stage === "EXP-02" ? "Enter" : "Space");
      await expect(
        track.locator('[data-content-id$="/dependent-teaching"]'),
      ).toBeVisible();
      await expect(options.first()).toBeFocused();
    }
  }
  await expect(
    track.locator('[data-fact-id$="/percentage"]').first(),
  ).toContainText("10%");
  await expect(
    track.locator('[data-fact-id$="/percentage"]').nth(1),
  ).toContainText("20%");
  await track.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(track.getByRole("group").getByRole("button")).toHaveCount(2);
  await track.getByRole("group").getByRole("button").last().click();
  await expect(
    track.locator('[data-fact-id$="selected-track/original"]'),
  ).toContainText("10000");
  await page.evaluate(() =>
    (window as unknown as { t044: { block(): void } }).t044.block(),
  );
  await expect(
    track.getByRole("group").getByRole("button").first(),
  ).toBeDisabled();
  await page.evaluate(() =>
    (window as unknown as { t044: { unblock(): void } }).t044.unblock(),
  );
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(track).toHaveCount(0);
  await page
    .getByRole("button", { name: "Explore and Learn", exact: true })
    .click();
  await expect(track.getByText("Stage: ACTIVE", { exact: true })).toBeVisible();
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
    await page.getByRole("button", { name: label, exact: true }).click();
    const track = page.locator("[data-c04-track]");
    await expect(track).toHaveAttribute("data-c04-track", id!);
    await expect(track.locator("dl > div")).toHaveCount(2);
    await expect(track.getByRole("group")).toHaveCount(0);
    await expect(track).not.toContainText("UNDEFINED — NO PERCENTAGE REPORTED");
    await expect(track).not.toContainText("-10%");
  });
}
