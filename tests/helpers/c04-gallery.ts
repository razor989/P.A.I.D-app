import type { Page } from "@playwright/test";

/** The C04 activity gallery separates presentation selection from opening:
 * select the activity's cover (a radio), then open it from the panel. */
export async function openC04Activity(
  page: Page,
  label: string,
  input: "click" | "tap" | "keyboard" = "click",
) {
  const cover = page.getByRole("radio", { name: label, exact: true });
  const open = page.getByRole("button", {
    name: new RegExp(`^(Start|Resume) ${label}( again)?$`),
  });
  if (input === "keyboard") {
    await cover.focus();
    await page.keyboard.press("Space");
    await open.focus();
    await page.keyboard.press("Enter");
  } else if (input === "tap") {
    await cover.tap();
    await open.tap();
  } else {
    await cover.click();
    await open.click();
  }
}
