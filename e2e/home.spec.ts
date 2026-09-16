import { expect, test } from "@playwright/test";

test("home page renders the Awenda Jewelry wordmark", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("banner").getByText("Awenda Jewelry"),
  ).toBeVisible();
});
