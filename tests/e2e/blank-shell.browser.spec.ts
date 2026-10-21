import { expect, test } from "@playwright/test";

test("real T036 bootstrap resolves the genuine empty memory read", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#root")).toBeAttached();
  await expect(page.locator("#root")).not.toBeEmpty();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveTitle("P.A.I.D. — Learning Library");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
  await expect(page.getByRole("button")).toHaveCount(6);
  await expect(
    page.getByText(/Recovery Choice|C04-A0|lesson complete/i),
  ).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Learning Library",
  );
});
