import { expect, test } from "@playwright/test";
import { deleteTestAdmin, hasMessageTo, loginAsAdmin } from "./helpers/admin";

// Phase 4 step 1. Exercises the real magic-link flow against local Supabase
// + Mailpit (EMBEDDINGS_PROVIDER=fake is irrelevant here — no embeddings
// involved — but ADMIN_EMAILS/SUPABASE_SERVICE_ROLE_KEY must be set for the
// dev server, via .env.local, since playwright.config.ts's webServer.env
// doesn't set them; see docs/plan/04-admin-cataloging.md).
const ADMIN_EMAIL = "e2e-admin@example.com";
const STRANGER_EMAIL = "e2e-stranger@example.com";

test.describe("admin auth", () => {
  test.afterEach(async () => {
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("anonymous visitor to /admin is redirected to /admin/login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("an allowlisted user can sign in and reach /admin", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await expect(page).toHaveURL(/\/admin(\/catalog)?$/);
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test("a non-allowlisted email gets the generic message and no email is sent", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(STRANGER_EMAIL);
    await page.getByRole("button", { name: "Send link" }).click();
    await expect(page.getByText(/sign-in link has been sent/i)).toBeVisible();

    await page.waitForTimeout(3000);
    expect(await hasMessageTo(STRANGER_EMAIL)).toBe(false);
  });
});
