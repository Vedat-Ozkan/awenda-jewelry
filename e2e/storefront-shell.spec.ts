import { expect, test } from "@playwright/test";

// Phase 5 step 1 (i18n scaffold) + step 3 (design system). Folds in what
// e2e/home.spec.ts used to check (now deleted — the "/" -> "/en" redirect
// replaces the old placeholder home page) and the 390px/1280px no-scroll
// check from step 3's verify line, kept to 3 tests total per the owner's
// "keep tests lean" instruction for this chunk.
test("/ redirects to /en and renders without horizontal scroll at 390px and 1280px", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/en$/);
  await expect(page.getByRole("banner").getByText("Awenda Jewelry")).toBeVisible();

  for (const width of [390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(width);
  }
});

test("/fr shows French chrome", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByRole("link", { name: "Politiques" })).toBeVisible();
});

test("the language switcher on /fr leads to /en on the same path", async ({ page }) => {
  await page.goto("/fr");
  // Header and footer both render a <LanguageSwitcher>, so scope to the
  // header landmark; exact: true, otherwise the substring "en" also matches
  // "Awenda Jewelry" and "Pendentifs".
  await page.getByRole("banner").getByRole("link", { name: "EN", exact: true }).click();
  await expect(page).toHaveURL(/\/en$/);
});
