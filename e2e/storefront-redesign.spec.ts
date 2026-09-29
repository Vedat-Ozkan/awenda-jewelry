import { expect, test } from "@playwright/test";

// Silver Mist redesign (DECISIONS.md 2026-09-29): home sections, the desktop
// pill nav, and the phone menu. Runs against supabase/seed.sql.

test("home renders the hero, 8 category tiles, 4 best sellers and 4 trust tiles", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { level: 1, name: "Quiet shine for every day." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop new in" })).toBeVisible();

  const tiles = page.getByRole("region", { name: "Shop by category" }).getByRole("link");
  await expect(tiles).toHaveCount(8);
  await expect(tiles.first()).toHaveAttribute("href", "/en/c/necklace");

  const bestSellers = page.getByRole("heading", { name: "Best sellers" }).locator("xpath=../..");
  await expect(bestSellers.locator('a[href^="/en/p/"]')).toHaveCount(4);

  await expect(page.getByRole("heading", { name: "All designs" })).toBeVisible();
  await expect(page.getByText("Secure checkout")).toBeVisible();
  await expect(page.getByTestId("newsletter-form")).toBeVisible();
});

test("/fr home shows the French hero", async ({ page }) => {
  await page.goto("/fr");
  await expect(page.getByRole("heading", { level: 1, name: "Un éclat discret, tous les jours." })).toBeVisible();
});

test("desktop nav links to categories, the Bag pill goes to the cart, and EN/FR swaps locale", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");

  const header = page.getByRole("banner");
  await expect(header.getByRole("button", { name: "Menu" })).toBeHidden();
  await expect(header.getByRole("link", { name: "Bag (0)" })).toHaveAttribute("href", "/en/cart");

  await header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Rings", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/c\/ring$/);

  await header.getByRole("link", { name: "FR", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/c\/ring$/);
  await expect(header.getByRole("link", { name: "Panier (0)" })).toBeVisible();
});

test("phone menu opens, closes on Escape with focus back on the button, and navigates", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");

  const header = page.getByRole("banner");
  const menu = header.getByRole("button", { name: "Menu" });
  await expect(header.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop all" })).toBeVisible();
  await expect(header.getByRole("link", { name: "FR", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(header.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(menu).toBeFocused();

  await menu.click();
  await header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Rings", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/c\/ring$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await header.getByRole("link", { name: "FR", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/c\/ring$/);
});
