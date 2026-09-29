import { expect, test } from "./fixtures";

// DECISIONS.md "Structured metal on designs" (2026-09-29): `?metal=` filter on
// the category listing, against supabase/seed.sql (the "Silver *" designs are
// sterling silver, everything else stainless steel). Assertions use hrefs and
// data-testids, not the filter's translated labels, so they don't depend on
// the `catalog.metal.*` message keys.

test("?metal=sterling_silver shows only the sterling silver designs in a category", async ({ page }) => {
  await page.goto("/en/c/necklace?metal=sterling_silver");

  const cards = page.locator('a[href^="/en/p/"]');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("href", "/en/p/silver-necklace-16");
});

test("?metal=stainless_steel shows only the stainless steel designs in a category", async ({ page }) => {
  await page.goto("/en/c/necklace?metal=stainless_steel");

  const cards = page.locator('a[href^="/en/p/"]');
  await expect(cards).toHaveCount(1);
  await expect(cards.first()).toHaveAttribute("href", "/en/p/gold-necklace-20");
});

test("an unknown metal is ignored; the filter links keep the category and switch metal", async ({ page }) => {
  await page.goto("/en/c/necklace?metal=gold");
  await expect(page.locator('a[href^="/en/p/"]')).toHaveCount(2);

  const filter = page.getByTestId("metal-filter");
  await expect(filter.locator('a[href="/en/c/necklace?metal=sterling_silver"]')).toBeVisible();
  await filter.locator('a[href="/en/c/necklace?metal=sterling_silver"]').click();
  await expect(page).toHaveURL(/\/en\/c\/necklace\?metal=sterling_silver$/);
  await expect(page.locator('a[href^="/en/p/"]')).toHaveCount(1);
});

test("changing the sort keeps the metal filter", async ({ page }) => {
  await page.goto("/en/c/bangle?metal=sterling_silver");
  await expect(page.locator('a[href^="/en/p/"]')).toHaveCount(1);

  await page.locator("select").selectOption("price_desc");
  await expect(page).toHaveURL(/metal=sterling_silver/);
  await expect(page).toHaveURL(/sort=price_desc/);
  await expect(page.locator('a[href^="/en/p/"]')).toHaveCount(1);
});
