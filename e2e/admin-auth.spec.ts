import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, hasMessageTo, loginAsAdmin } from "./helpers/admin";

// Phase 4 step 1. Exercises the real magic-link flow against local Supabase
// + Mailpit (EMBEDDINGS_PROVIDER=fake is irrelevant here — no embeddings
// involved — but ADMIN_EMAILS/SUPABASE_SERVICE_ROLE_KEY must be set for the
// dev server, via .env.local, since playwright.config.ts's webServer.env
// doesn't set them; see docs/plan/04-admin-cataloging.md).
const ADMIN_EMAIL = "e2e-admin@example.com";
const STRANGER_EMAIL = "e2e-stranger@example.com";
const PASSWORD = "e2e-correct-horse-battery";

// Allowlisted user with a password, created via the service-role admin API
// (the owner does the same once via the Supabase dashboard).
async function createPasswordAdmin(email: string, password: string) {
  const supabase = createServiceClient();
  const { error: allowError } = await supabase.from("admin_emails").upsert({ email });
  if (allowError) throw allowError;
  const { error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
}

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

  test("an allowlisted user can sign in with email and password", async ({ page }) => {
    await createPasswordAdmin(ADMIN_EMAIL, PASSWORD);

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin(\/catalog)?$/);
    await expect(page.getByText(ADMIN_EMAIL)).toBeVisible();
  });

  test("a wrong password shows the generic error", async ({ page }) => {
    await createPasswordAdmin(ADMIN_EMAIL, PASSWORD);

    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Wrong email or password.")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("a non-allowlisted email gets the generic message and no email is sent", async ({ page }) => {
    await page.goto("/admin/login");
    await page.getByLabel("Email").fill(STRANGER_EMAIL);
    await page.getByRole("button", { name: "Email me a sign-in link instead" }).click();
    await expect(page.getByText(/sign-in link has been sent/i)).toBeVisible();

    await page.waitForTimeout(3000);
    expect(await hasMessageTo(STRANGER_EMAIL)).toBe(false);
  });
});
