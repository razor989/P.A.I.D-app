import { expect, test, type Page } from "@playwright/test";
import { openGalleryActivity } from "../helpers/activity-gallery";
test.use({ channel: "chrome", launchOptions: { args: ["--disable-gpu"] } });

type Cue = {
  cue: string;
  sequence: string | null;
  atMs: number;
  audible: boolean;
};

/** Every cue the engine decides to play is announced as `paid:sound-cue`;
 * a cancelled sequence (an interruption, or StrictMode's dev-only effect
 * replay) is announced as `paid:sound-cancel` and its voices are stopped. */
async function recordCues(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __cues: unknown[] };
    w.__cues = [];
    window.addEventListener("paid:sound-cue", (event) =>
      w.__cues.push((event as CustomEvent).detail),
    );
    window.addEventListener("paid:sound-cancel", (event) =>
      w.__cues.push({
        cancelled: (event as CustomEvent<{ sequence: string }>).detail.sequence,
      }),
    );
  });
}
type Entry = Cue | { cancelled: string };
const log = (page: Page) =>
  page.evaluate(() => (window as unknown as { __cues: Entry[] }).__cues);
const cues = async (page: Page) =>
  (await log(page)).filter((e): e is Cue => "cue" in e);
const clearCues = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __cues: Entry[] }).__cues = [];
  });
/** The cues of the run of `name` that was not cancelled afterwards. */
const named = async (page: Page, name: string) => {
  const entries = await log(page);
  const runs: Cue[][] = [[]];
  for (const e of entries)
    if ("cancelled" in e) {
      if (e.cancelled === name) runs.push([]);
    } else if (e.sequence === name) runs.at(-1)!.push(e);
  return runs.at(-1)!;
};

async function openLibrary(page: Page) {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Overtime Pay", exact: true }),
  ).toBeVisible();
  // Let the cues decode (they load quietly at startup).
  await page.waitForTimeout(1500);
}

async function recordPrepare(page: Page) {
  await page.getByRole("button", { name: /Start with Nico/ }).click();
  await page.getByRole("button", { name: /Share my first thinking/ }).click();
  await page
    .getByRole("radio", {
      name: "I would start with the usual pay for each hour.",
      exact: true,
    })
    .check();
  await page.getByRole("button", { name: /Next question/ }).click();
  await page
    .getByRole("radio", {
      name: "I'm not sure yet; I would like to compare ideas.",
      exact: true,
    })
    .check();
  await page
    .getByRole("button", { name: "Record my thinking", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finish Prepare", exact: true }),
  ).toBeVisible();
}

test("sound follows the choreography and only authoritative results", async ({
  page,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await recordCues(page);
  await openLibrary(page);
  await clearCues(page);

  // Library → Competency: Accordion Unfold, accents on the panel landings.
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).click();
  await expect
    .poll(async () => (await named(page, "accordion.forward")).length)
    .toBeGreaterThan(2);
  await page.waitForTimeout(800);
  const unfold = await named(page, "accordion.forward");
  const ticks = unfold.filter((c) => c.cue === "nav.tick");
  expect(ticks.length).toBeGreaterThanOrEqual(3);
  ticks.forEach((t, i) =>
    expect(t.atMs).toBe(Math.round(40 + i * 30 + 260 * 0.6)),
  );
  expect(unfold.find((c) => c.cue === "nav.settle")?.atMs).toBe(
    40 + (ticks.length - 1) * 30 + 260,
  );

  // Gallery → Lesson: Tear-Away Chapter.
  await clearCues(page);
  await openGalleryActivity(page, "Prepare");
  await page.waitForTimeout(900);
  const enter = await named(page, "chapter.forward");
  expect(enter.map((c) => [c.cue, c.atMs])).toEqual([
    ["chapter.slide", 0],
    ["chapter.perforation", 260],
    ["chapter.release", 394],
    ["chapter.release", 424],
    ["nav.tick", 560],
  ]);
  expect(enter.every((c) => c.audible)).toBe(true);

  // Prepare records participation: one neutral cue, never a judgement.
  await clearCues(page);
  await recordPrepare(page);
  let heard = (await cues(page)).map((c) => c.cue);
  expect(heard.filter((c) => c === "response.recorded")).toHaveLength(1);
  expect(heard.filter((c) => c.startsWith("feedback."))).toEqual([]);
  expect(heard).not.toContain("activity.complete");

  // A restored, already-recorded response is silent.
  await page.reload();
  await page
    .getByRole("button", { name: "Continue unfinished activity", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Finish Prepare", exact: true }),
  ).toBeVisible();
  heard = (await cues(page)).map((c) => c.cue);
  expect(heard).not.toContain("response.recorded");

  // Completion sounds once, when the Session finalizes.
  await clearCues(page);
  await page
    .getByRole("button", { name: "Finish Prepare", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return to Overtime Pay", exact: true }),
  ).toBeEnabled();
  await page.waitForTimeout(300);
  heard = (await cues(page)).map((c) => c.cue);
  expect(heard.filter((c) => c === "activity.complete")).toHaveLength(1);

  // Lesson → Gallery: Chapter Return.
  await clearCues(page);
  await page
    .getByRole("button", { name: "Return to Overtime Pay", exact: true })
    .click();
  await page.waitForTimeout(900);
  expect(
    (await named(page, "chapter.back")).map((c) => [c.cue, c.atMs]),
  ).toEqual([
    ["chapter.slide.back", 0],
    ["chapter.seal", 210],
    ["nav.land", 600],
  ]);

  // Reviewing a completed activity replays nothing.
  await clearCues(page);
  await page
    .getByRole("button", { name: "Review completed activity", exact: true })
    .click();
  await page.waitForTimeout(900);
  heard = (await cues(page)).map((c) => c.cue);
  expect(
    heard.filter((c) => /^(feedback|response|activity)\./.test(c)),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test("the sound switch mutes immediately and persists", async ({ page }) => {
  await recordCues(page);
  await openLibrary(page);
  const toggle = page
    .getByRole("button", { name: "Sound effects", exact: true })
    .filter({ visible: true })
    .first();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await clearCues(page);
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).click();
  await page.waitForTimeout(900);
  expect(await cues(page)).toEqual([]);
  await page.reload();
  await expect(
    page
      .getByRole("button", { name: "Sound effects", exact: true })
      .filter({ visible: true })
      .first(),
  ).toHaveAttribute("aria-pressed", "false");
  expect(
    await page.evaluate(() =>
      localStorage.getItem("paid.preferences.sound.v1"),
    ),
  ).toBe('{"enabled":false}');
});

test("reduced motion keeps sound but uses the quiet fallback", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await recordCues(page);
  await openLibrary(page);
  await clearCues(page);
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).click();
  await page.waitForTimeout(600);
  expect((await named(page, "fallback.forward")).map((c) => c.cue)).toEqual([
    "nav.fallback",
  ]);
  expect(
    (await cues(page)).filter((c) => c.sequence !== "fallback.forward"),
  ).toEqual([]);
});

test("the app is complete without Web Audio", async ({ page }) => {
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>;
    delete w.AudioContext;
    delete w.webkitAudioContext;
    delete w.OfflineAudioContext;
  });
  await recordCues(page);
  await page.goto("/");
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sound effects", exact: true }),
  ).toHaveCount(0);
  await openGalleryActivity(page, "Prepare");
  await recordPrepare(page);
  await page
    .getByRole("button", { name: "Finish Prepare", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Return to Overtime Pay", exact: true }),
  ).toBeEnabled();
  expect(await cues(page)).toEqual([]);
  expect(errors).toEqual([]);
});

async function openC03(page: Page, activity: string) {
  await openLibrary(page);
  await page.getByRole("button", { name: "Overtime Pay", exact: true }).click();
  await openGalleryActivity(page, activity);
  await page.waitForTimeout(900);
}

test("an explanation playing by itself turns pages and sounds its visuals", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await recordCues(page);
  await openC03(page, "Explore and Learn");
  await page.getByRole("button", { name: /Start the investigation/ }).click();
  const story = page.getByRole("region", {
    name: "Overtime explanation",
    exact: true,
  });
  await page.waitForTimeout(600);
  await clearCues(page);
  await page
    .getByRole("button", { name: "Play explanation", exact: true })
    .click();
  await expect(story).toHaveAttribute("data-moment", "1", { timeout: 20_000 });
  await page.waitForTimeout(400);
  await page
    .getByRole("button", { name: "Pause playback", exact: true })
    .click();
  let heard = (await cues(page)).map((c) => c.cue);
  expect(heard[0]).toBe("ui.toggle.on");
  expect(heard).toContain("story.grow");
  expect(heard.filter((c) => c === "story.moment")).toHaveLength(1);
  expect(heard[heard.length - 1]).toBe("ui.toggle.off");

  // A deliberate step is one step sound, never a page turn as well.
  await page.waitForTimeout(400);
  await clearCues(page);
  await page.getByRole("button", { name: "Next moment", exact: true }).click();
  await expect(story).toHaveAttribute("data-moment", "2");
  await page.waitForTimeout(600);
  heard = (await cues(page)).map((c) => c.cue);
  expect(heard.filter((c) => c === "model.step")).toHaveLength(1);
  expect(heard.filter((c) => c.startsWith("story."))).toEqual([]);

  // Pop-ups whisper open, tick across parts, grow their record and close.
  await page.getByRole("button", { name: "Next moment", exact: true }).click();
  await expect(story).toHaveAttribute("data-moment", "3");
  await page.waitForTimeout(600);
  await clearCues(page);
  await page.locator('[data-inspect="rate"]').first().focus();
  await page.waitForTimeout(300);
  await page
    .locator(
      '[data-inspect="condition"]:visible, [data-inspect="multiplier"]:visible, [data-inspect="pay"]:visible',
    )
    .first()
    .focus();
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  heard = (await cues(page)).map((c) => c.cue);
  expect(heard.filter((c) => c.startsWith("inspect."))).toEqual([
    "inspect.open",
    "inspect.switch",
    "inspect.close",
  ]);
  expect(heard).toContain("story.grow");
});

test("a work-record pop-up sounds its pieces landing, unless motion is reduced", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const reduced of [false, true]) {
    await page.emulateMedia({
      reducedMotion: reduced ? "reduce" : "no-preference",
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    if (!reduced) await recordCues(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await openC03(page, "Prepare");
    await page.getByRole("button", { name: /Start with Nico/ }).click();
    // The record's facts show from the second moment on.
    await page
      .getByRole("button", { name: "Next moment", exact: true })
      .first()
      .click();
    const tile = page.locator("[data-explore]:visible").first();
    await expect(tile).toBeVisible({ timeout: 20_000 });
    await page.waitForTimeout(600);
    await clearCues(page);
    await tile.focus();
    await page.waitForTimeout(1800);
    const heard = (await cues(page)).map((c) => c.cue);
    expect(heard[0]).toBe("inspect.open");
    const pieces = heard.filter((c) => c === "story.piece").length;
    if (reduced) expect(pieces).toBe(0);
    else expect(pieces).toBeGreaterThan(0);
  }
});
