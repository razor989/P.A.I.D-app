import { expect, test } from "@playwright/test";

test("production shell initial skip and genuine destination heading focus", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to main content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page
    .getByRole("button", { name: "Explore and Learn", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("real AppShell fixture ignores object churn and independent notice", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/t042-accessibility.html?shell");
  await page
    .getByRole("button", { name: "Synthetic competency", exact: true })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  const same = page.getByRole("button", {
    name: "Same destination and notice",
  });
  await same.click();
  await expect(same).toBeFocused();
  await expect(page.locator("[data-accessibility-status]")).toHaveText("");
  await expect(
    page.getByText("Synthetic independent notice.", { exact: true }),
  ).toHaveCount(1);
});

test("synthetic step, syntax, recovery, persistent status and T041 modal boundaries", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/t042-accessibility.html");
  const heading = page.getByRole("heading", { level: 2 });
  await page.getByRole("button", { name: "Major step", exact: true }).click();
  await expect(heading).toBeFocused();
  await page.getByRole("button", { name: "Same step", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Same step", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Recovered orientation" }).click();
  await expect(heading).toBeFocused();
  const check = page.getByRole("button", {
    name: "Check coherent incorrect response",
  });
  await check.click();
  await expect(check).toBeFocused();
  await expect(page.getByRole("textbox")).not.toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByRole("button", { name: "Signal structural defect" }).click();
  await expect(page.getByRole("textbox")).toBeFocused();
  const invoke = page.getByRole("button", { name: "Open modal", exact: true });
  await invoke.click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("button", { name: "Close modal" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Signal while modal open" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    dialog.getByRole("button", { name: "Signal while modal open" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close modal" }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(invoke).toBeFocused();
  await expect(page.getByLabel("Close count")).toHaveText("1");
  await expect(page.getByLabel("Fallback count")).toHaveText("0");
  const status = page.locator("[data-accessibility-status]");
  await expect(status).toHaveText("");
  await page.getByRole("button", { name: "Announce safe status" }).click();
  await expect(status).toHaveText("Synthetic visible safe status.");
  await status
    .locator("span")
    .evaluate((e) => e.setAttribute("data-original", "true"));
  await page.getByRole("button", { name: "Announce safe status" }).click();
  await expect(status.locator("span")).toHaveAttribute("data-original", "true");
  await page.getByRole("button", { name: "New equal-text event" }).click();
  await expect(status.locator("span")).not.toHaveAttribute(
    "data-original",
    "true",
  );
  await page.getByRole("button", { name: "Clear status" }).click();
  await expect(status).toHaveText("");
});

for (const availability of ["eligible", "disconnected", "disabled", "inert"]) {
  test(`captured real invoker ${availability}: safe close chronology`, async ({
    page,
  }, testInfo) => {
    await page.goto("/tests/fixtures/t042-accessibility.html");
    const invoke = page.getByRole("button", {
      name: "Open modal",
      exact: true,
    });
    await invoke.focus();
    await page.evaluate(() => {
      const observations: unknown[] = [];
      Object.assign(window, { t042FocusChronology: observations });
      document.addEventListener("focusin", (event) => {
        const element = event.target as HTMLElement;
        observations.push({
          event: "focusin",
          tag: element.tagName,
          text: element.textContent,
          modal: document.querySelector("dialog:modal") !== null,
          time: performance.now(),
        });
      });
      document.addEventListener(
        "close",
        () =>
          observations.push({
            event: "native-close",
            modal: document.querySelector("dialog:modal") !== null,
            time: performance.now(),
          }),
        true,
      );
    });
    await page.keyboard.press("Enter");
    const dialog = page.getByRole("dialog");
    await expect(
      dialog.getByRole("button", { name: "Close modal" }),
    ).toBeFocused();
    if (availability !== "eligible") {
      await dialog
        .getByRole("button", { name: `Make captured invoker ${availability}` })
        .click();
      const actual = await page.evaluate(() => {
        const element = [...document.querySelectorAll("button")].find(
          (e) => e.textContent === "Open modal",
        );
        return {
          connected: Boolean(element?.isConnected),
          disabled: element?.disabled ?? false,
          inert: element?.inert ?? false,
          modal: Boolean(document.querySelector("dialog:modal")),
        };
      });
      expect(actual.modal).toBe(true);
      expect(
        availability === "disconnected"
          ? !actual.connected
          : availability === "disabled"
            ? actual.disabled
            : actual.inert,
      ).toBe(true);
    }
    await dialog
      .getByRole("button", { name: "Signal while modal open" })
      .click();
    await expect(
      dialog.getByRole("button", { name: "Signal while modal open" }),
    ).toBeFocused();
    await expect(page.getByLabel("Fallback count")).toHaveText("0");
    const beforeClose = await page.evaluate(
      () =>
        (window as unknown as { t042FocusChronology: { tag?: string }[] })
          .t042FocusChronology,
    );
    expect(beforeClose.filter((e) => e.tag === "H2")).toHaveLength(0);
    await page.keyboard.press("Escape");
    const fallback = availability !== "eligible";
    await expect(page.getByLabel("Close count")).toHaveText("1");
    await expect(page.getByLabel("Fallback count")).toHaveText(
      fallback ? "1" : "0",
    );
    await expect(
      fallback ? page.getByRole("heading", { level: 2 }) : invoke,
    ).toBeFocused();
    const chronology = await page.evaluate(
      () =>
        (
          window as unknown as {
            t042FocusChronology: {
              tag?: string;
              modal: boolean;
              text?: string;
            }[];
          }
        ).t042FocusChronology,
    );
    expect(chronology.filter((e) => e.tag === "H2")).toHaveLength(
      fallback ? 1 : 0,
    );
    expect(
      chronology.filter((e) => e.tag === "H2").every((e) => !e.modal),
    ).toBe(true);
    if (!fallback)
      expect(
        chronology.filter(
          (e) => e.tag === "BUTTON" && e.text === "Open modal" && !e.modal,
        ),
      ).toHaveLength(1);
    await testInfo.attach(`captured-${availability}-focus-chronology`, {
      body: JSON.stringify(chronology, null, 2),
      contentType: "application/json",
    });
    console.log(
      `T042 captured ${availability} focus chronology ${JSON.stringify(chronology)}`,
    );
  });
}

test("native StrictMode status deduplication, equal-text identity and 280 character bound", async ({
  page,
}) => {
  await page.goto("/tests/fixtures/t042-accessibility.html");
  const status = page.locator("[data-accessibility-status]");
  await page
    .getByRole("button", { name: "Announce safe status", exact: true })
    .click();
  await expect(status).toHaveText("Synthetic visible safe status.");
  await status
    .locator("span")
    .evaluate((e) => e.setAttribute("data-original", "true"));
  await page
    .getByRole("button", { name: "Announce safe status", exact: true })
    .click();
  await expect(status.locator("span")).toHaveAttribute("data-original", "true");
  await page.getByRole("button", { name: "New equal-text event" }).click();
  await expect(status.locator("span")).not.toHaveAttribute(
    "data-original",
    "true",
  );
  await page.getByRole("button", { name: "Announce 280 characters" }).click();
  await expect(status).toHaveText("x".repeat(280));
  await page.getByRole("button", { name: "Announce 281 characters" }).click();
  await expect(status).toHaveText("");
  await expect(page.getByText("x".repeat(281), { exact: true })).toBeVisible();
});
