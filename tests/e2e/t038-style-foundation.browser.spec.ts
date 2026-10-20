import { expect, test } from "@playwright/test";

test("T038 real entry loads local fonts and responsive light foundation", async ({
  page,
}) => {
  const external: string[] = [];
  const failures: string[] = [];
  const fonts: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400)
      failures.push(`${response.status()} ${response.url()}`);
    if (new URL(response.url()).pathname.endsWith(".woff2"))
      fonts.push(response.url());
  });
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== "http://127.0.0.1:4179") {
      external.push(url.href);
      await route.abort();
    } else await route.continue();
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toHaveText("Library is ready.");
  const initial = await page.evaluate(async () => {
    const specs = [
      '600 24px "Lexend"',
      '400 16px "Atkinson Hyperlegible"',
      '700 16px "Atkinson Hyperlegible"',
      'italic 400 16px "Atkinson Hyperlegible"',
      '400 20px "IBM Plex Mono"',
    ];
    const loaded = [];
    for (const spec of specs) {
      const faces = await document.fonts.load(
        spec,
        "P.A.I.D. 0123456789 ₱ − × ÷ %",
      );
      loaded.push({
        spec,
        count: faces.length,
        statuses: faces.map((f) => f.status),
      });
    }
    await document.fonts.ready;
    return {
      loaded,
      background: getComputedStyle(document.documentElement).backgroundColor,
      color: getComputedStyle(document.body).color,
      bodyFont: getComputedStyle(document.body).fontFamily,
      headingFont: getComputedStyle(document.querySelector("h1")!).fontFamily,
      colorScheme: getComputedStyle(document.documentElement).colorScheme,
    };
  });
  expect(initial.background).toBe("rgb(251, 247, 239)");
  expect(initial.color).toBe("rgb(38, 49, 40)");
  expect(initial.bodyFont).toContain("Atkinson Hyperlegible");
  expect(initial.headingFont).toContain("Lexend");
  expect(initial.colorScheme).toBe("light");
  for (const face of initial.loaded) {
    expect(face.count, face.spec).toBe(1);
    expect(face.statuses).toEqual(["loaded"]);
  }
  expect(new Set(fonts).size).toBe(5);
  expect(external).toEqual([]);
  expect(failures).toEqual([]);

  // Test-only DOM fixtures exercise opt-in primitives, never production screens.
  await page.evaluate(() => {
    const fixture = document.createElement("section");
    fixture.id = "t038-fixture";
    fixture.className = "paid-workspace paid-split";
    const primary = document.createElement("div");
    primary.textContent =
      "Readable instructional context and long labels ".repeat(8);
    const support = document.createElement("div");
    support.className = "paid-technical";
    support.textContent = "Rate 12.50% × basis ₱1,000 = ₱125";
    const control = document.createElement("button");
    control.textContent = "Foundation focus probe";
    primary.append(control);
    fixture.append(primary, support);
    document.body.append(fixture);
  });
  for (const [width, padding, columns] of [
    [320, 16, 1],
    [639, 16, 1],
    [640, 24, 1],
    [1023, 24, 1],
    [1024, 32, 2],
    [1440, 32, 2],
  ]) {
    await page.setViewportSize({ width: width!, height: 900 });
    const layout = await page.locator("#t038-fixture").evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        padding: parseFloat(style.paddingInlineStart),
        columns: style.gridTemplateColumns.split(" ").length,
        width: element.getBoundingClientRect().width,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
        text: element.textContent,
      };
    });
    expect(layout.padding).toBe(padding);
    expect(layout.columns).toBe(columns);
    expect(layout.width).toBeLessThanOrEqual(1152);
    expect(layout.overflow).toBe(false);
    expect(layout.text).toContain("Rate 12.50%");
  }
  await page.setViewportSize({ width: 320, height: 900 });
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    document.documentElement.style.removeProperty("font-size");
  });
  await page.keyboard.press("Tab");
  const button = page.getByRole("button", { name: "Foundation focus probe" });
  await expect(button).toBeFocused();
  expect(await button.evaluate((e) => getComputedStyle(e).outlineWidth)).toBe(
    "3px",
  );
  await page.emulateMedia({ forcedColors: "active" });
  expect(await button.evaluate((e) => getComputedStyle(e).outlineStyle)).toBe(
    "solid",
  );
  await page.emulateMedia({ forcedColors: "none", colorScheme: "dark" });
  expect(
    await page.evaluate(
      () => getComputedStyle(document.documentElement).backgroundColor,
    ),
  ).toBe("rgb(251, 247, 239)");
  expect(external).toEqual([]);
  expect(failures).toEqual([]);
  console.log("T038 font loads", JSON.stringify(initial.loaded));
});
