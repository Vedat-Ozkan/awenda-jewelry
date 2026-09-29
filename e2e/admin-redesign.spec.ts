import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Silver Mist admin restyle (DECISIONS.md "Visual redesign"): phone tab bar,
// desktop top bar, and the login card.
const ADMIN_EMAIL = "e2e-redesign-admin@example.com";
const PASSWORD = "e2e-correct-horse-battery";

test.describe("admin redesign", () => {
  test.afterEach(async () => {
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("phone: the bottom tab bar navigates between Catalog, Orders and Analytics", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog");

    const tabs = page.getByRole("navigation", { name: "Sections" });
    await expect(tabs).toBeVisible();
    // Only the tab bar is shown on a phone; the desktop links are display:none.
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
    for (const name of ["Catalog", "New", "Orders", "Analytics", "Settings"]) {
      const box = await tabs.getByRole("link", { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.height, `${name} tab height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${name} tab width`).toBeGreaterThanOrEqual(44);
    }
    await expect(tabs.getByRole("link", { name: "Catalog", exact: true })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Orders", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await expect(page.getByRole("heading", { name: "Orders" })).toBeVisible();
    await expect(tabs.getByRole("link", { name: "Orders", exact: true })).toHaveAttribute("aria-current", "page");

    await tabs.getByRole("link", { name: "Analytics", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/analytics/);
    await expect(page.getByRole("heading", { name: "Analytics" })).toBeVisible();
    // Wide charts scroll inside their card, not the page.
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    // dispatchEvent, not click(): the Next.js dev-tools badge (dev server
    // only) floats over the bottom-left corner and intercepts real pointer
    // events aimed at the first tab.
    await tabs.getByRole("link", { name: "Catalog", exact: true }).dispatchEvent("click");
    await expect(page).toHaveURL(/\/admin\/catalog$/);
    await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();

    await tabs.getByRole("link", { name: "New", exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/catalog\/new$/);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(390);
  });

  test("desktop: the top-bar links navigate and there is no tab bar", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/catalog");

    const nav = page.getByRole("navigation", { name: "Sections" });
    await expect(nav).toBeVisible();
    // The phone tab bar is hidden, so exactly one navigation is exposed.
    await expect(page.getByRole("navigation", { name: "Sections" })).toHaveCount(1);
    await expect(nav.getByRole("link", { name: "New", exact: true })).toHaveCount(0);
    await expect(page.getByText("Admin", { exact: true })).toBeVisible();

    await nav.getByRole("link", { name: "Orders" }).click();
    await expect(page).toHaveURL(/\/admin\/orders$/);
    await nav.getByRole("link", { name: "Analytics" }).click();
    await expect(page).toHaveURL(/\/admin\/analytics/);
    await nav.getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await nav.getByRole("link", { name: "Catalog" }).click();
    await expect(page).toHaveURL(/\/admin\/catalog$/);
  });

  test("login: renders the card and signs in with a password", async ({ page }) => {
    const supabase = createServiceClient();
    const { error: allowError } = await supabase.from("admin_emails").upsert({ email: ADMIN_EMAIL });
    if (allowError) throw allowError;
    const { error } = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/login");
    await expect(page.getByRole("heading", { name: "Admin sign-in" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Email me a sign-in link instead" })).toBeVisible();

    const email = page.getByLabel("Email");
    const box = await email.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);

    await email.fill(ADMIN_EMAIL);
    await page.getByLabel("Password").fill(PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin(\/catalog)?$/);
    await expect(page.getByRole("heading", { name: "Catalog" })).toBeVisible();
  });
});
