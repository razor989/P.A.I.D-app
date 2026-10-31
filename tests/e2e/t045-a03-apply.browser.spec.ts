import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
test.setTimeout(120_000);
async function enter(page: Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /An offer,\s*revised/ }),
  ).toBeVisible();
  await expect(page.getByText("₱30,000", { exact: true })).toBeVisible();
  await expect(page.getByText("₱27,000", { exact: true })).toBeVisible();
  expect(
    await page.locator('[data-c04-track="C04-A03"]').innerHTML(),
  ).not.toMatch(/-3000|−3,000|−10%|-10%|10% decrease/);
  await page.getByRole("button", { name: /Work on the offer/ }).click();
}
async function fill(page: Page, wrong = false) {
  await page
    .getByRole("button", { name: "Set the reference", exact: true })
    .click();
  for (const [label, value] of [
    ["Original salary", "30000"],
    ["New salary", "27000"],
  ])
    await page
      .getByRole("textbox", { name: new RegExp(`^${label}`) })
      .fill(value!);
  await page.getByRole("button", { name: /Work out the change →/ }).click();
  for (const [label, value] of [
    ["Signed difference", wrong ? "3000" : "-3000"],
    ["Percentage change", wrong ? "10" : "-10"],
  ])
    await page
      .getByRole("textbox", { name: new RegExp(`^${label}`) })
      .fill(value!);
  await page.getByRole("button", { name: /State your conclusion →/ }).click();
  await page
    .getByRole("group", { name: "Interpretation of the offer" })
    .getByRole("button")
    .nth(wrong ? 1 : 0)
    .click();
}

test("formatted paste, composition, backtracking and restored draft can be checked", async ({
  page,
}) => {
  await enter(page);
  await page
    .getByRole("textbox", { name: /^Original salary/ })
    .pressSequentially("30000");
  await page.getByRole("textbox", { name: /^New salary/ }).fill("₱27,000");
  await page.getByRole("button", { name: /Work out the change →/ }).click();
  const difference = page.getByRole("textbox", { name: /^Signed difference/ });
  await difference.fill("−3,000");
  await difference.dispatchEvent("compositionstart");
  await page.getByRole("textbox", { name: /^Percentage change/ }).fill("−10%");
  await page.getByRole("button", { name: /State your conclusion →/ }).click();
  await page
    .getByRole("group", { name: "Interpretation of the offer" })
    .getByRole("button")
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Complete Signed difference before checking/),
  ).toBeVisible();
  await page.getByRole("button", { name: /Back to the calculation/ }).click();
  await difference.dispatchEvent("compositionend");
  await page.getByRole("button", { name: /State your conclusion →/ }).click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await page
    .getByRole("button", { name: "State your conclusion", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Check", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("[data-feedback]")).toContainText("Confirmed");
});
test("real route: independent application, reconsider/revise/recheck, recovery and durable continuation", async ({
  page,
}, info) => {
  await enter(page);
  await fill(page, true);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("[data-feedback]")).toContainText("negative");
  await expect(
    page.getByRole("button", { name: "See your recap →", exact: true }),
  ).toHaveCount(0);
  await page.screenshot({
    path: info.outputPath("reconsideration.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Revise response" }).click();
  await page
    .getByRole("button", { name: "Work out the change", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: /^Signed difference/ }),
  ).toHaveValue("3000");
  expect(
    await page.locator('[data-c04-track="C04-A03"]').innerHTML(),
  ).not.toMatch(/−10%|-10%|10% decrease/);
  await fill(page);
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("[data-feedback]")).toContainText("Confirmed");
  const model = page.getByRole("region", { name: "The offer on one scale" });
  const bars = model.locator("svg rect");
  expect(
    Number(await bars.nth(1).getAttribute("width")) /
      Number(await bars.nth(0).getAttribute("width")),
  ).toBe(0.9);
  await model
    .getByRole("button", { name: "Inspect the removed portion", exact: true })
    .hover();
  await expect(model.locator("aside")).toContainText("negative sign");
  await model
    .getByRole("button", { name: "Inspect original offer", exact: true })
    .focus();
  await expect(model.locator("aside")).toContainText("reference");
  await model
    .getByRole("button", { name: "Inspect the removed portion", exact: true })
    .click();
  await expect(
    model.getByRole("button", {
      name: "Inspect the removed portion",
      exact: true,
    }),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(
    page.getByRole("button", { name: "See your recap →", exact: true }),
  ).toBeEnabled();
  await page.screenshot({
    path: info.outputPath("confirmation.png"),
    fullPage: true,
  });
  const scan = await new AxeBuilder({ page }).analyze();
  expect(scan.violations).toEqual([]);
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(page.locator("[data-feedback]")).toContainText("Confirmed");
  await page
    .getByRole("button", { name: "See your recap →", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: /The offer,\s*in perspective\./ }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("completion.png"),
    fullPage: true,
  });
  await expect(page.locator("[data-recap]")).toContainText(
    "The revised monthly offer is lower",
  );
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: /Revisit the relationship/ }).click();
  await expect(
    page.getByRole("button", { name: "Inspect original offer", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 320, height: 900 });
  await page
    .getByRole("button", { name: "Inspect the removed portion", exact: true })
    .click();
  await expect(page.locator("aside")).toContainText("negative sign");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("recap-320.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.getByRole("button", { name: /Back to recap/ }).click();
  await page.getByRole("button", { name: /Next activity/ }).click();
  await expect(page.locator('[data-c04-track="C04-A04"]')).toBeVisible();
});
for (const width of [320, 390, 683, 1024, 1366])
  test(`independent workspace ${width}px keyboard and static parity`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await enter(page);
    await expect(page.getByRole("textbox")).toHaveCount(2);
    await expect(page.getByRole("checkbox")).toHaveCount(0);
    const scaleFree = await page
      .locator('[data-c04-track="C04-A03"]')
      .ariaSnapshot();
    expect(scaleFree).not.toMatch(/−3,000|−10%|-3000|-10%/);
    await page.screenshot({
      path: info.outputPath(`reference-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.getByRole("button", { name: /Work out the change →/ }).click();
    await page.screenshot({
      path: info.outputPath(`calculation-${width}.png`),
      fullPage: true,
    });
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page
      .getByRole("button", { name: "State your conclusion", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Check", exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Review", exact: true }),
    ).toHaveCount(0);
    await fill(page);
    await page.screenshot({
      path: info.outputPath(`workspace-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const scan = await new AxeBuilder({ page }).analyze();
    expect(scan.violations).toEqual([]);
    await info.attach("AX-workspace", {
      body: await page.locator("body").ariaSnapshot(),
      contentType: "text/plain",
    });
  });

test("all quantity representations remain expressible and revisable without automatic calculation", async ({
  page,
}) => {
  await enter(page);
  for (const role of ["Original salary", "New salary"]) {
    const detail = page
      .getByRole("textbox", { name: new RegExp(`^${role}`) })
      .locator("..")
      .locator("..")
      .locator("details");
    await detail.locator("summary").click();
    await detail.getByRole("combobox").selectOption("UNDEFINED");
    await expect(
      page.getByRole("textbox", { name: new RegExp(`^${role}`) }),
    ).toBeDisabled();
  }
  await page.getByRole("button", { name: /Work out the change →/ }).click();
  for (const detail of await page
    .locator("details")
    .filter({ has: page.locator("select") })
    .all()) {
    await detail.locator("summary").click();
    const select = detail.getByRole("combobox");
    await select.selectOption("UNDEFINED");
  }
  await page.getByRole("button", { name: /State your conclusion →/ }).click();
  await page
    .getByRole("group", { name: "Interpretation of the offer" })
    .getByRole("button")
    .last()
    .click();
  await page.getByRole("button", { name: "Check", exact: true }).click();
  await expect(page.locator("[data-feedback]")).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(page.getByLabel("Your submitted calculation")).toContainText(
    "Undefined",
  );
  await page.getByRole("button", { name: "Revise response" }).click();
  await expect(page.getByRole("combobox").first()).toHaveValue("UNDEFINED");
});

test("accepted identity, keyboard investigation, touch emulation and forced colors", async ({
  page,
  browser,
}, info) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await page.getByRole("button", { name: "Prepare", exact: true }).click();
  const accepted = await page
    .locator('[data-c04-track="C04-A01"] .primary')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        font: s.fontFamily,
        radius: s.borderRadius,
        padding: s.padding,
        color: s.color,
      };
    });
  // Separate fresh route for identity sampling; not a Recovery test.
  await page.evaluate(() => localStorage.clear());
  await enter(page);
  const actual = await page
    .locator('[data-c04-track="C04-A03"] .primary')
    .first()
    .evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        font: s.fontFamily,
        radius: s.borderRadius,
        padding: s.padding,
        color: s.color,
      };
    });
  expect(actual).toEqual(accepted);
  await info.attach("accepted-control-comparison", {
    body: JSON.stringify({ accepted, actual }, null, 2),
    contentType: "application/json",
  });
  await page.getByRole("textbox", { name: /^Original salary/ }).focus();
  await page.keyboard.type("30000");
  await page.keyboard.press("Tab");
  await page.getByRole("textbox", { name: /^New salary/ }).focus();
  await page.keyboard.type("27000");
  await page.getByRole("button", { name: /Work out the change →/ }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "Work out the change", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ forcedColors: "active" });
  await page.screenshot({
    path: info.outputPath("forced-colors.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const touch = await browser.newContext({
    hasTouch: true,
    isMobile: true,
    viewport: { width: 390, height: 844 },
  });
  const touchPage = await touch.newPage();
  await touchPage.goto("http://127.0.0.1:4179/");
  await touchPage
    .getByRole("button", { name: "Percentage Change", exact: true })
    .tap();
  await touchPage.getByRole("button", { name: "Apply", exact: true }).tap();
  await touchPage.getByRole("button", { name: /Work on the offer/ }).tap();
  await touchPage
    .getByRole("button", { name: "Work out the change", exact: true })
    .tap();
  await expect(
    touchPage.getByRole("textbox", { name: /^Signed difference/ }),
  ).toBeVisible();
  await touch.close();
});
