import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:4179/")
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/tests/fixtures/t040-controls.html");
});

test("native keyboard and pointer intents, lossless decimal draft and semantic states", async ({
  page,
}) => {
  const action = page.getByRole("button", {
    name: "Synthetic action",
    exact: true,
  });
  await page.keyboard.press("Tab");
  await expect(action).toBeFocused();
  await page.keyboard.press("Enter");
  await page.keyboard.press("Space");
  await action.click();
  await expect(page.getByRole("status", { name: "Action count" })).toHaveText(
    "3",
  );
  await expect(
    page.getByRole("button", { name: "Disabled action" }),
  ).toBeDisabled();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("radio", { name: "Synthetic alpha" }),
  ).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("radio", { name: "Synthetic beta" }),
  ).toBeChecked();
  await expect(page.getByRole("status", { name: "Last choice" })).toHaveText(
    "synthetic-b",
  );
  await page.keyboard.press("Tab");
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("checkbox", { name: "Synthetic first" }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Synthetic second" }).click();
  await expect(
    page.getByRole("checkbox", { name: "Synthetic first" }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Synthetic second" }),
  ).toBeChecked();
  const decimal = page.getByRole("textbox", {
    name: "Synthetic exact decimal",
  });
  for (const draft of ["-", "1.", "1,25"]) {
    await decimal.fill(draft);
    await expect(decimal).toHaveValue(draft);
    await expect(decimal).toHaveAttribute("aria-invalid", "true");
  }
  await decimal.fill("+00123.456789012345678900");
  await expect(decimal).toHaveValue("+00123.456789012345678900");
  await expect(decimal).not.toHaveAttribute("aria-invalid", "true");
  await expect(
    page.getByText("Synthetic withheld: Withheld", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0", { exact: true })).toBeVisible();
  console.log(
    "T040 native keyboard/pointer and decimal/semantic state proof passed",
  );
});

test("48px operable targets, forced-colors focus, reflow and enlarged text", async ({
  page,
}) => {
  for (const target of await page
    .locator("button, label:has(input), input[type=text]")
    .all()) {
    const bounds = await target.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.width).toBeGreaterThanOrEqual(48);
    expect(bounds!.height).toBeGreaterThanOrEqual(48);
    console.log("T040 operable bounds", await target.textContent(), bounds);
  }
  await page.emulateMedia({ forcedColors: "active" });
  await page.keyboard.press("Tab");
  const action = page.getByRole("button", {
    name: "Synthetic action",
    exact: true,
  });
  await expect(action).toBeFocused();
  expect(
    await action.evaluate((element) => getComputedStyle(element).outlineWidth),
  ).toBe("3px");
  await page.emulateMedia({ forcedColors: "none" });
  // 1280 CSS-pixel desktop at 400% browser zoom has a 320 CSS-pixel layout viewport.
  await page.setViewportSize({ width: 320, height: 900 });
  for (const percent of [100, 200]) {
    await page.evaluate((scale) => {
      document.documentElement.style.fontSize = `${scale}%`;
    }, percent);
    await page.addStyleTag({
      content:
        "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    for (const target of await page.locator("label:has(input), button").all()) {
      expect(
        await target.evaluate(
          (element) =>
            element.scrollWidth <= element.clientWidth &&
            element.scrollHeight <= element.clientHeight,
        ),
      ).toBe(true);
    }
  }
  console.log(
    "T040 320px/400%-equivalent layout, 200% text, spacing and forced-colors proof passed",
  );
});
