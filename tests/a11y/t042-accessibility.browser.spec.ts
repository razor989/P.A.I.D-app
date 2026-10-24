import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const url of [
  "/",
  "/tests/fixtures/t042-accessibility.html",
  "/tests/fixtures/t042-accessibility.html?shell",
]) {
  test(`axe, withheld DOM/ARIA and reflow: ${url}`, async ({ page }) => {
    await page.goto(url);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await expect(page.getByRole("main")).toHaveCount(1);
    expect(await page.locator("body").innerHTML()).not.toMatch(
      /WITHHELD_TEST_ANSWER|FORBIDDEN_ANSWER|PRIVATE_PROVIDER/,
    );
    expect(await page.locator("body").ariaSnapshot()).not.toMatch(
      /WITHHELD_TEST_ANSWER|FORBIDDEN_ANSWER|PRIVATE_PROVIDER/,
    );
    expect(
      await page
        .locator("[tabindex]")
        .evaluateAll((els) =>
          els.every((e) => Number(e.getAttribute("tabindex")) <= 0),
        ),
    ).toBe(true);
    await page.emulateMedia({
      forcedColors: "active",
      reducedMotion: "reduce",
    });
    await page.setViewportSize({ width: 320, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button").first().focus();
    expect(
      await page
        .getByRole("button")
        .first()
        .evaluate((e) => parseFloat(getComputedStyle(e).outlineWidth)),
    ).toBeGreaterThanOrEqual(3);
    await test.info().attach("accessibility-tree", {
      body: await page.locator("body").ariaSnapshot(),
      contentType: "text/plain",
    });
    await test.info().attach("320px-forced-colors", {
      body: await page.screenshot({ fullPage: true }),
      contentType: "image/png",
    });
  });
}

test("isolated noncanonical hidden descendants cannot enter the polite status or accessibility projection", async ({
  page,
}, testInfo) => {
  await page.goto("/tests/fixtures/t042-accessibility.html?negative");
  const marker = "SYNTHETIC_T042_HIDDEN_ONLY_MARKER";
  const status = page.locator("[data-accessibility-status]");
  const cdp = await page.context().newCDPSession(page);
  const results: unknown[] = [];
  for (const mode of [
    "hidden",
    "display",
    "visibility",
    "aria-hidden",
    "inert",
  ]) {
    await page.goto("/tests/fixtures/t042-accessibility.html?negative");
    // A successful visible event precedes every rejection, exercising stale-status removal too.
    await page
      .getByRole("button", { name: "Announce safe status", exact: true })
      .click();
    await expect(status).toHaveText("Synthetic visible safe status.");
    await status.evaluate((element) => {
      const mutations: string[] = [];
      Object.assign(window, { t042StatusMutations: mutations });
      new MutationObserver((records) =>
        mutations.push(
          ...records.map((record) => record.target.textContent ?? ""),
        ),
      ).observe(element, {
        subtree: true,
        childList: true,
        characterData: true,
      });
    });
    await page
      .getByRole("button", {
        name: `Attempt hidden descendant ${mode}`,
        exact: true,
      })
      .click();
    await expect(status).toHaveText("");
    const source = page
      .getByRole("region", {
        name: "Isolated synthetic hidden-descendant negative case",
      })
      .locator("p");
    expect(await source.textContent()).toContain(marker);
    // The intentional negative marker is present in this isolated DOM, not in the live target.
    expect(await source.innerHTML()).toContain(marker);
    expect(await status.innerHTML()).not.toContain(marker);
    const snapshot = await page.locator("body").ariaSnapshot();
    expect(await status.ariaSnapshot()).not.toContain(marker);
    // Playwright's DOM-derived snapshot includes inert prose in this browser/toolchain.
    // Use Chromium's actual exposed AX nodes, preserving the snapshot as diagnostics.
    const axNodes = (await cdp.send("Accessibility.getFullAXTree")).nodes;
    const exposedMarkers = axNodes.filter(
      (node) =>
        !node.ignored && String(node.name?.value ?? "").includes(marker),
    );
    expect(exposedMarkers).toEqual([]);
    if (mode !== "inert") expect(snapshot).not.toContain(marker);
    const statusMutations = await page.evaluate(
      () =>
        (window as unknown as { t042StatusMutations: string[] })
          .t042StatusMutations,
    );
    expect(statusMutations.join(" ")).not.toContain(marker);
    expect(await page.locator("body").innerHTML()).not.toMatch(
      /WITHHELD_TEST_ANSWER|FORBIDDEN_ANSWER|PRIVATE_PROVIDER/,
    );
    const axe = await new AxeBuilder({ page }).analyze();
    expect(axe.violations).toEqual([]);
    results.push({
      mode,
      sourceDOM: await source.innerHTML(),
      statusDOM: await status.innerHTML(),
      statusMutations,
      snapshot,
      exposedMarkers,
      violations: axe.violations,
    });
  }
  await testInfo.attach("hidden-descendant-negative-evidence", {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  console.log(
    `T042 hidden-descendant negative evidence ${JSON.stringify(results)}`,
  );
  await cdp.detach();
});
