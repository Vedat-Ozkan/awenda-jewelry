import { expect, test } from "./fixtures";

// Silver Mist redesign (DECISIONS.md 2026-09-29): home sections, the desktop
// pill nav, and the phone menu. Runs against supabase/seed.sql.

test("home renders the hero, 8 category tiles, 4 new-in designs and 4 trust tiles", async ({ page }) => {
  await page.goto("/en");

  await expect(page.getByRole("heading", { level: 1, name: "Quiet shine for every day." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Shop new in" })).toBeVisible();

  const tiles = page.getByRole("region", { name: "Shop by category" }).getByRole("link");
  await expect(tiles).toHaveCount(8);
  await expect(tiles.first()).toHaveAttribute("href", "/en/c/necklace");

  const newIn = page.getByRole("heading", { name: "New in" }).locator("xpath=../..");
  await expect(newIn.locator('a[href^="/en/p/"]')).toHaveCount(4);

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
  const menu = header.getByRole("button", { name: /menu/i });
  await expect(header.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toHaveAccessibleName("Menu");

  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded", "true");
  await expect(menu).toHaveAccessibleName("Close menu");
  await expect(header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Shop all" })).toBeVisible();
  await expect(header.getByRole("link", { name: "FR", exact: true })).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(header.getByRole("navigation", { name: "Main" })).toHaveCount(0);
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAccessibleName("Menu");

  // Tapping outside the card closes it and returns focus to the button too.
  await menu.click();
  await page.mouse.click(195, 800);
  await expect(menu).toHaveAttribute("aria-expanded", "false");
  await expect(menu).toBeFocused();

  await menu.click();
  await header.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Rings", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/c\/ring$/);
  await expect(menu).toHaveAttribute("aria-expanded", "false");

  await menu.click();
  await header.getByRole("link", { name: "FR", exact: true }).click();
  await expect(page).toHaveURL(/\/fr\/c\/ring$/);
});

test("New in link goes to the home new-in section, distinct from Shop all", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/en");

  const nav = page.getByRole("banner").getByRole("navigation", { name: "Main" });
  await expect(nav.getByRole("link", { name: "Shop all" })).toHaveAttribute("href", "/en#catalog");
  await expect(nav.getByRole("link", { name: "New in" })).toHaveAttribute("href", "/en#new-in");

  await nav.getByRole("link", { name: "New in" }).click();
  await expect(page).toHaveURL(/\/en#new-in$/);
  await expect(page.locator("#new-in")).toBeInViewport();
  await expect(page.getByRole("heading", { name: "New in" })).toBeInViewport();
});
