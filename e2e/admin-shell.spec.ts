import { expect, test } from "@playwright/test";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 4 step 2.
const ADMIN_EMAIL = "e2e-shell-admin@example.com";

test.describe("admin shell", () => {
  test.afterEach(async () => {
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("renders at 390px wide with no horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page, ADMIN_EMAIL);

    await expect(page.getByRole("link", { name: "Catalog" })).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });
});
