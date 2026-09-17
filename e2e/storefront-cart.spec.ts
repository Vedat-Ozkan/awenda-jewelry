import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";

// Phase 5 step 6. Kept to 3 tests per the owner's "keep tests lean"
// instruction for this chunk. Uses single-variant seeded designs
// (hoop-earring-os, heart-pendant-os) so ProductPurchasePanel never renders
// the size fieldset — keeps these locators simple, same reasoning
// storefront-pages.spec.ts gives for its own product picks.

test("add two in-stock designs from their product pages, badge shows 2, cart lists both with correct totals", async ({
  page,
}) => {
  await page.goto("/en/p/hoop-earring-os");
  await page.getByTestId("add-to-cart").click();

  await page.goto("/en/p/heart-pendant-os");
  await page.getByTestId("add-to-cart").click();

  await expect(page.getByTestId("cart-count")).toHaveText("2");

  await page.goto("/en/cart");
  await page.reload();

  await expect(page.getByText("Hoop Earrings")).toBeVisible();
  await expect(page.getByText("Heart Pendant")).toBeVisible();
  // $15.00 (hoop-earring-os) + $29.00 (heart-pendant-os), shipping disabled
  // in the seed, so subtotal === total.
  await expect(page.getByTestId("cart-subtotal")).toHaveText("$44.00");
  await expect(page.getByTestId("cart-total")).toHaveText("$44.00");
});

test("a variant set to 0 stock marks its cart line unavailable and disables checkout", async ({ page }) => {
  const supabase = createServiceClient();
  const variantId = "b0000000-0000-4000-8000-000000000018"; // hoop-earring-os, One size, qty 6

  await page.goto("/en/p/hoop-earring-os");
  await page.getByTestId("add-to-cart").click();
  await page.goto("/en/cart");
  await expect(page.getByTestId("cart-total")).toBeVisible();

  const { error: zeroError } = await supabase.rpc("adjust_inventory", {
    p_variant_id: variantId,
    p_delta: -6,
    p_reason: "adjustment",
  });
  if (zeroError) throw zeroError;

  try {
    await page.reload();
    await expect(page.getByText("No longer available — remove")).toBeVisible();
    await expect(page.getByTestId("checkout")).toBeDisabled();
  } finally {
    const { error: restoreError } = await supabase.rpc("adjust_inventory", {
      p_variant_id: variantId,
      p_delta: 6,
      p_reason: "restock",
    });
    if (restoreError) throw restoreError;
  }
});

test("switching fulfillment to Ship changes the total by the flat shipping rate", async ({ page }) => {
  const supabase = createServiceClient();
  const { error: enableError } = await supabase.from("settings").update({ shipping_enabled: true }).eq("id", 1);
  if (enableError) throw enableError;

  try {
    await page.goto("/en/p/heart-pendant-os");
    await page.getByTestId("add-to-cart").click();
    await page.goto("/en/cart");

    await expect(page.getByTestId("cart-total")).toHaveText("$29.00");
    await page.getByLabel(/Ship/).click();
    // shipping_flat_cents = 500 in the seed; $29.00 subtotal is below the
    // $50.00 free-shipping threshold, so the full flat rate applies.
    await expect(page.getByTestId("cart-total")).toHaveText("$34.00");
  } finally {
    const { error: restoreError } = await supabase.from("settings").update({ shipping_enabled: false }).eq("id", 1);
    if (restoreError) throw restoreError;
  }
});
