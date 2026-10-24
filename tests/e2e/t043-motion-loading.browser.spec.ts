import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function command(page: Page, action: string) {
  await page.evaluate(
    (key) =>
      (window as unknown as { t043: Record<string, () => void> }).t043[key]!(),
    action,
  );
  // Flush React's scheduled commit before advancing the controlled clock.
  await page.evaluate(
    () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
  );
}

async function observeLoading(page: Page) {
  await page.evaluate(() => {
    const seen: string[] = [];
    Object.assign(window, { t043LoadingMutations: seen });
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          const text = node.textContent ?? "";
          if (/Please wait|Clearing saved work/.test(text)) seen.push(text);
        }
      }
    }).observe(document.getElementById("root")!, {
      subtree: true,
      childList: true,
    });
  });
}

async function loadingEvidence(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  const tree = await cdp.send("Accessibility.getFullAXTree");
  await cdp.detach();
  return {
    exposedLoading: tree.nodes.filter(
      (node) =>
        !node.ignored &&
        /Please wait|Clearing saved work/.test(String(node.name?.value ?? "")),
    ),
    mutations: await page.evaluate(
      () =>
        (window as unknown as { t043LoadingMutations: string[] })
          .t043LoadingMutations,
    ),
  };
}

for (const reducedMotion of ["no-preference", "reduce"] as const) {
  test(`real Session and queue threshold boundaries, focus and barriers: ${reducedMotion}`, async ({
    page,
  }, info) => {
    test.setTimeout(90_000);
    const requests: string[] = [];
    await page.route("**/*", (route) => {
      const url = route.request().url();
      if (
        !url.startsWith("http://127.0.0.1:4179/") &&
        !url.startsWith("data:")
      ) {
        requests.push(url);
        return route.abort();
      }
      return route.continue();
    });
    await page.emulateMedia({ reducedMotion });
    const records: unknown[] = [];
    for (const duration of [299, 300, 301]) {
      await page.goto("/tests/fixtures/t043-motion-loading.html?mode=session");
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Learning Library",
      );
      await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
      await page.clock.pauseAt(new Date("2030-01-02T00:00:00Z"));
      const heading = page.getByRole("heading", { level: 1 });
      await heading.focus();
      await observeLoading(page);
      // React's MessageChannel scheduling remains live while only timers are paused.
      await page.evaluate(() =>
        (window as unknown as { t043: { start(): void } }).t043.start(),
      );
      await expect(page.getByRole("button").first()).toBeDisabled();
      expect(await page.locator("body").innerHTML()).not.toContain(
        "Please wait",
      );
      await page.clock.runFor(duration);
      await expect(page.getByText(/Please wait/)).toHaveCount(
        duration < 300 ? 0 : 1,
      );
      if (duration >= 300)
        await expect(page.getByText(/Please wait/)).toBeVisible();
      await expect(heading).toBeFocused();
      const snapshot = await page.locator("body").ariaSnapshot();
      const evidence = await loadingEvidence(page);
      if (duration < 300) {
        expect(evidence.exposedLoading).toEqual([]);
        expect(evidence.mutations).toEqual([]);
      } else expect(evidence.mutations).toHaveLength(1);
      records.push({ path: "Session", duration, snapshot, evidence });
      await page.evaluate(() =>
        (window as unknown as { t043: { finish(): void } }).t043.finish(),
      );
      await expect(page.getByText(/Please wait/)).toHaveCount(0);
      await expect(page.getByRole("button").first()).toBeEnabled();
      await page.clock.resume();
    }
    for (const duration of [299, 300, 301]) {
      await page.goto("/tests/fixtures/t043-motion-loading.html?mode=clearing");
      const discard = page.getByRole("button", {
        name: "Discard unusable saved work",
      });
      await expect(discard).toBeVisible();
      await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
      await page.clock.pauseAt(new Date("2030-01-02T00:00:00Z"));
      await observeLoading(page);
      await discard.focus();
      await discard.press("Enter");
      await expect(
        page.getByRole("region", { name: "Startup and saved work" }),
      ).toBeFocused();
      await expect(page.getByRole("button")).toHaveCount(0);
      expect(await page.locator("body").innerHTML()).not.toContain(
        "Clearing saved work",
      );
      expect(await page.locator("body").ariaSnapshot()).not.toContain(
        "Clearing saved work",
      );
      await page.clock.runFor(duration);
      await expect(page.getByText(/Clearing saved work/)).toHaveCount(
        duration < 300 ? 0 : 1,
      );
      const evidence = await loadingEvidence(page);
      if (duration < 300) {
        expect(evidence.exposedLoading).toEqual([]);
        expect(evidence.mutations).toEqual([]);
      } else expect(evidence.mutations).toHaveLength(1);
      records.push({
        path: "real queue",
        duration,
        snapshot: await page.locator("body").ariaSnapshot(),
        evidence,
      });
      await page.evaluate(() =>
        (
          window as unknown as { t043: { resolveClear(): void } }
        ).t043.resolveClear(),
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        "Learning Library",
      );
      await expect(page.getByText(/Clearing saved work/)).toHaveCount(0);
      await page.clock.resume();
    }
    expect(requests).toEqual([]);
    await info.attach("production-timing-evidence", {
      body: JSON.stringify(
        { reducedMotion, records, externalRequests: requests },
        null,
        2,
      ),
      contentType: "application/json",
    });
  });

  test(`synthetic semantic lifetime, motion tokens, keyboard, cancellation: ${reducedMotion}`, async ({
    page,
  }, info) => {
    await page.emulateMedia({ reducedMotion });
    await page.goto("/tests/fixtures/t043-motion-loading.html");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    const durations = await page
      .locator(".motion-fast, .motion-standard, .motion-model")
      .evaluateAll((elements) =>
        elements.map((e) => ({
          duration: getComputedStyle(e).transitionDuration,
          easing: getComputedStyle(e).transitionTimingFunction,
          opacity: getComputedStyle(e).opacity,
        })),
      );
    expect(durations.map((x) => x.duration)).toEqual(
      reducedMotion === "reduce"
        ? ["0s", "0s", "0s"]
        : ["0.12s", "0.18s", "0.24s"],
    );
    expect(durations.every((x) => x.opacity === "1")).toBe(true);
    if (reducedMotion === "no-preference")
      expect(
        durations.every((x) => x.easing === "cubic-bezier(0.2, 0, 0, 1)"),
      ).toBe(true);
    await page.keyboard.press("Tab");
    const start = page.getByRole("button", {
      name: "Start technical operation",
      exact: true,
    });
    await expect(start).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByText("Synthetic authorized technical operation pending."),
    ).toBeVisible();
    await expect(start).toBeFocused();
    await page
      .getByRole("button", { name: "Complete technical operation" })
      .click();
    await expect(
      page.getByText("Synthetic authorized technical operation pending."),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "Next synthetic step" }).click();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      "Synthetic explanation step 2",
    );
    await page
      .getByRole("button", { name: "Explicit synthetic reveal" })
      .click();
    await page.clock.install();
    await page.clock.runFor(10000);
    await expect(
      page.getByText(
        "Synthetic authorized reveal and reinforcement remain available.",
      ),
    ).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(
      "Synthetic explanation step 2",
    );
    await start.click();
    await page.getByRole("button", { name: "Toggle Loading owner" }).click();
    await page.clock.runFor(1000);
    await expect(
      page.getByText("Synthetic authorized technical operation pending."),
    ).toHaveCount(0);
    await info.attach("semantic-state", {
      body: await page.locator("body").ariaSnapshot(),
      contentType: "text/plain",
    });
  });
}

test("real clearing failure is immediate and retry has a fresh gate", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/t043-motion-loading.html?mode=clearing");
  await page
    .getByRole("button", { name: "Discard unusable saved work" })
    .click();
  await command(page, "rejectClear");
  await expect(page.getByRole("status")).toHaveText(
    "Saved work could not yet be cleared. Library is not available.",
  );
  await expect(page.getByRole("status")).toBeFocused();
  await page.getByRole("button", { name: "Retry clearing" }).click();
  await expect(page.getByText(/Clearing saved work/)).toHaveCount(0);
  await expect(page.getByText(/Clearing saved work/)).toBeVisible();
  await command(page, "resolveClear");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
});
