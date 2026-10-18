import { expect, test } from "@playwright/test";

test("real T035 bootstrap renders honest unresolved startup", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("P.A.I.D. — Startup");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("P.A.I.D.");
  await expect(page.getByRole("status")).toHaveText(
    "Startup is unresolved. Recovery has not been evaluated.",
  );
  await expect(page.getByRole("button")).toHaveCount(0);
  await expect(
    page.getByText(/Library|Recovery Choice|C04-A0|lesson complete/i),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("status")).toContainText("Startup is unresolved");
});
