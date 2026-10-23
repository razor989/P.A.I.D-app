import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  await page.route("**/*", (route) =>
    route.request().url().startsWith("http://127.0.0.1:4179/")
      ? route.continue()
      : route.abort(),
  );
  await page.goto("/tests/fixtures/t041-surfaces.html");
});

test("current feedback removal, separate Information Needed and withheld DOM", async ({
  page,
}) => {
  await page
    .getByRole("button", { name: "Supply Confirmation", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Confirmation", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Supply Reconsideration", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Reconsideration", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("textbox")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByRole("textbox").fill("18");
  expect(await page.locator("body").innerHTML()).not.toMatch(
    /Synthetic current (confirmation|reconsideration) content/,
  );
  expect(await page.locator("body").ariaSnapshot()).not.toMatch(
    /Synthetic current (confirmation|reconsideration) content/,
  );
  await page
    .getByRole("button", { name: "Authorize Information Needed", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Information Needed", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Return from Information Needed" })
    .click();
  await expect(
    page.getByText(
      "Synthetic caller-authorized missing information explanation.",
    ),
  ).toHaveCount(0);
  expect(await page.locator("body").innerHTML()).not.toMatch(
    /FORBIDDEN_ANSWER|PRIVATE_PROVIDER|FORBIDDEN_FIELD/,
  );
});

test("native modal containment, inertness, exactly-once safe close and return focus across reopenings", async ({
  page,
}) => {
  const observations: unknown[] = [];
  const initial = await page.evaluate(() => ({
    url: location.href,
    history: history.length,
  }));
  for (const [index, mode] of ["Review", "Source Review", "Review"].entries()) {
    const invoke = page.getByRole("button", {
      name: `Open compact ${mode}`,
      exact: true,
    });
    await invoke.focus();
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog", {
      name: "Synthetic read-only support",
    });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((element) => {
      const counts = { cancel: 0, close: 0 };
      element.addEventListener("cancel", () => {
        counts.cancel++;
      });
      element.addEventListener("close", () => {
        counts.close++;
      });
      (
        window as unknown as { t041NativeCounts: typeof counts }
      ).t041NativeCounts = counts;
    });
    expect(
      await dialog.evaluate(
        (d) => d instanceof HTMLDialogElement && d.matches(":modal"),
      ),
    ).toBe(true);
    const buttons = dialog.getByRole("button", {
      name: "Close support",
      exact: true,
    });
    await expect(buttons.first()).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(buttons.last()).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(buttons.first()).toBeFocused();
    for (let n = 0; n < 6; n++) {
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((d) => d.contains(document.activeElement)),
      ).toBe(true);
    }
    const background = page.getByRole("button", {
      name: "Background action",
      exact: true,
    });
    await background.evaluate((b) => b.focus());
    expect(
      await dialog.evaluate((d) => d.contains(document.activeElement)),
    ).toBe(true);
    const box = await background.boundingBox();
    if (!box) throw new Error("Background bounds missing");
    await page.mouse.click(box.x + 2, box.y + 2);
    await expect(
      page.getByRole("status", { name: "Background count" }),
    ).toHaveText("0");
    observations.push({
      index,
      mode,
      modalSnapshot: await dialog.ariaSnapshot(),
      active: await page.evaluate(() => document.activeElement?.outerHTML),
    });
    if (index === 1) await buttons.last().click();
    else await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    const nativeCounts = await page.evaluate(
      () =>
        (
          window as unknown as {
            t041NativeCounts: { cancel: number; close: number };
          }
        ).t041NativeCounts,
    );
    expect(nativeCounts.cancel).toBe(index === 1 ? 0 : 1);
    observations.push({ index, nativeCounts });
    await expect(invoke).toBeFocused();
    await expect(page.getByRole("status", { name: "Close count" })).toHaveText(
      String(index + 1),
    );
    await expect(
      page.getByRole("status", { name: "Destructive count" }),
    ).toHaveText("0");
    await expect(page.getByRole("textbox")).toHaveValue("17");
    expect(
      await page.evaluate(() => ({
        url: location.href,
        history: history.length,
      })),
    ).toEqual(initial);
    await expect(
      page.getByRole("status", { name: "Receiving activity" }),
    ).toHaveText("C04-A01");
    await expect(page.getByRole("status", { name: "Last close" })).toHaveText(
      `${mode === "Review" ? "REVIEW" : "SOURCE_REVIEW"}:C04-A01:REVISION:REVISION`,
    );
  }
  if (process.env.T041_EVIDENCE_DIR)
    fs.writeFileSync(
      path.join(
        process.env.T041_EVIDENCE_DIR,
        `modal-observations-${Date.now()}.json`,
      ),
      JSON.stringify(observations, null, 2),
    );
  console.log(
    "T041 real native modal observations",
    JSON.stringify(observations),
  );
});

test("compact and expanded source-safe content are equivalent and read-only", async ({
  page,
}) => {
  for (const mode of ["Review", "Source Review"]) {
    const snapshots: string[] = [];
    for (const form of ["compact", "expanded"]) {
      await page
        .getByRole("button", { name: `Open ${form} ${mode}`, exact: true })
        .click();
      const content = page.getByRole("region", { name: mode, exact: true });
      snapshots.push(await content.ariaSnapshot());
      expect(
        await content
          .locator("input, textarea, select, a, [contenteditable=true]")
          .count(),
      ).toBe(0);
      expect(await content.innerHTML()).not.toMatch(
        /FORBIDDEN|PRIVATE_PROVIDER/,
      );
      if (mode === "Source Review")
        await expect(
          content.locator("[data-field-id=synthetic-approved]"),
        ).toHaveText("Synthetic approved source field.");
      await content.getByRole("button", { name: "Close support" }).click();
    }
    expect(snapshots[0]).toBe(snapshots[1]);
  }
});

test("48px targets, 3px forced-colors focus, 320px reflow, text spacing and reduced motion", async ({
  page,
}) => {
  for (const target of await page.locator("button, input").all()) {
    const b = await target.boundingBox();
    expect(b).not.toBeNull();
    expect(b!.width).toBeGreaterThanOrEqual(48);
    expect(b!.height).toBeGreaterThanOrEqual(48);
  }
  await page.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await page
    .getByRole("button", { name: "Open compact Source Review", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const close = dialog.getByRole("button").first();
  expect(await close.evaluate((e) => getComputedStyle(e).outlineWidth)).toBe(
    "3px",
  );
  expect(await dialog.evaluate((e) => getComputedStyle(e).animationName)).toBe(
    "none",
  );
  if (process.env.T041_EVIDENCE_DIR)
    await page.screenshot({
      path: path.join(
        process.env.T041_EVIDENCE_DIR,
        `forced-colors-${Date.now()}.png`,
      ),
      fullPage: true,
    });
  await page.emulateMedia({ forcedColors: "none" });
  await page.setViewportSize({ width: 320, height: 900 });
  for (const scale of [100, 200]) {
    await page.evaluate((n) => {
      document.documentElement.style.fontSize = `${n}%`;
    }, scale);
    await page.addStyleTag({
      content:
        "* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }",
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(await dialog.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(
      true,
    );
    await close.scrollIntoViewIfNeeded();
    await expect(close).toBeInViewport();
    for (const b of await dialog.getByRole("button").all()) {
      expect(
        await b.evaluate(
          (e) =>
            e.scrollWidth <= e.clientWidth && e.scrollHeight <= e.clientHeight,
        ),
      ).toBe(true);
    }
    if (process.env.T041_EVIDENCE_DIR)
      await page.screenshot({
        path: path.join(
          process.env.T041_EVIDENCE_DIR,
          `reflow-${scale}-${Date.now()}.png`,
        ),
        fullPage: true,
      });
  }
  await close.click();
});
