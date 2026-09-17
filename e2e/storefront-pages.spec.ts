import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";

// Phase 5 steps 4, 5, 7, 10. Runs against supabase/seed.sql's 16 designs.
// Kept to 5 tests total per the owner's "keep tests lean" instruction for
// this chunk. The category test uses "earring" rather than "ring": in the
// seed data `ring` has no sold-out design (gold-ring-8 is a draft, excluded
// from the storefront entirely), while `earring` has stud-earring-os
// (qty 0) — the phase file's own fallback for exactly this case.

test("/en/c/earring shows only earring cards, sold-out after in-stock with the badge", async ({ page }) => {
  await page.goto("/en/c/earring");

  const cards = page.locator('a[href^="/en/p/"]');
  await expect(cards).toHaveCount(2);
  await expect(cards.nth(0)).toContainText("Hoop Earrings");
  await expect(cards.nth(1)).toContainText("Stud Earrings");
  await expect(cards.nth(1).getByText("Sold out")).toBeVisible();
});

test("product page lists only in-stock variants enabled and shows 4 similar cards", async ({ page }) => {
  await page.goto("/en/p/silver-ring-7");

  await expect(page.getByRole("button", { name: "6", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "7", exact: true })).toBeEnabled();
  await expect(page.getByRole("button", { name: "8 — Sold out" })).toBeDisabled();
  await expect(page.getByTestId("similar-styles").locator('a[href^="/en/p/"]')).toHaveCount(4);
});

test("stud-earring-os shows the sold-out panel and no variant picker", async ({ page }) => {
  await page.goto("/en/p/stud-earring-os");

  await expect(page.getByText("This design is sold out for now.")).toBeVisible();
  await expect(page.getByTestId("add-to-cart")).toHaveCount(0);
});

test("an old slug (previous_slugs) 301s to the design's current slug", async ({ page }) => {
  const supabase = createServiceClient();
  const { error: setError } = await supabase
    .from("designs")
    .update({ previous_slugs: ["old-slug-e2e"] })
    .eq("slug", "silver-necklace-16");
  if (setError) throw setError;

  try {
    await page.goto("/en/p/old-slug-e2e");
    await expect(page).toHaveURL(/\/en\/p\/silver-necklace-16$/);
  } finally {
    const { error: restoreError } = await supabase
      .from("designs")
      .update({ previous_slugs: [] })
      .eq("slug", "silver-necklace-16");
    if (restoreError) throw restoreError;
  }
});

test("/fr/p/does-not-exist shows the localized 404", async ({ page }) => {
  await page.goto("/fr/p/does-not-exist");
  await expect(page.getByRole("heading", { name: "Page introuvable" })).toBeVisible();
});
