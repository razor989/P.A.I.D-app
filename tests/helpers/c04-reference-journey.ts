import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { openC04Activity } from "./c04-gallery";

// Reference reading beats remain presentation-local; phase assertions observe
// the existing fixture's real actor, never infer engagement from display copy.
export async function enterReference(page: Page) {
  await page
    .getByRole("button", { name: "Percentage Change", exact: true })
    .click();
  await openC04Activity(page, "Explore and Learn");
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(page.locator(".c04-reference h1")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { level: 2, name: "Making sense of a raise" }),
  ).toBeVisible();
}

export const readingBeats = [
  "Explore the raises",
  "What does a percentage mean?",
  "Investigate Employee A",
  "Inspect the added money",
  "Compare with the starting salary",
  "Show that share out of 100",
  "What does this mean for the salary?",
  "Investigate Employee B",
  "Inspect the added money",
  "Investigate B’s share",
  "Compare with the starting salary",
  "Show that share out of 100",
  "What does this mean for the salary?",
  "Compare the two raises",
  "Compare out of 100",
  "Explain the difference",
  "Put the reasoning into a formula",
  "Compare the change with the original",
  "Express the share out of 100",
  "Where else does this reasoning apply?",
  "Try it together",
];

export async function readToPractice(page: Page) {
  for (const label of readingBeats) {
    await page.getByRole("button", { name: label, exact: false }).click();
  }
  await expect(page.getByRole("radio")).toHaveCount(3);
  await expect(page.getByRole("textbox")).toHaveCount(0);
}
