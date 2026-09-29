import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { createServiceClient } from "../tests/helpers/local-supabase";

// Phase 6 step 4. Orders aren't reachable through any UI flow yet (Stripe
// isn't wired up for real in this environment — see 06-checkout-orders.md's
// "resolved STOP answers"), so the order + items are inserted directly via
// the service client, matching how tests/integration/stripe-webhook.test.ts
// sets up its fixtures.

test.describe("order confirmation page", () => {
  const prefix = `e2e-order-${randomUUID().slice(0, 8)}`;
  let sessionId: string;
  let orderId: string;

  test.beforeAll(async () => {
    const supabase = createServiceClient();
    sessionId = `cs_test_${prefix}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        stripe_checkout_session_id: sessionId,
        status: "awaiting_pickup",
        fulfillment: "pickup",
        locale: "en",
        customer_email: "order-e2e@example.com",
        subtotal_cents: 2800,
        shipping_cents: 0,
        tax_cents: 0,
        total_cents: 2800,
      })
      .select("id")
      .single();
    if (orderError) throw orderError;
    orderId = order.id;

    const { error: itemsError } = await supabase.from("order_items").insert([
      {
        order_id: orderId,
        name_snapshot: "Hoop Earrings",
        variant_label_snapshot: "One size",
        unit_price_cents: 1800,
        qty: 1,
        fulfilled: true,
      },
      {
        order_id: orderId,
        name_snapshot: "Heart Pendant",
        variant_label_snapshot: "One size",
        unit_price_cents: 1000,
        qty: 1,
        fulfilled: false,
      },
    ]);
    if (itemsError) throw itemsError;
  });

  test.afterAll(async () => {
    const supabase = createServiceClient();
    await supabase.from("orders").delete().eq("id", orderId); // order_items cascades (0002_core.sql)
  });

  test("shows items, totals, and pickup instructions in English", async ({ page }) => {
    await page.goto(`/en/order/${sessionId}`);
    // Scoped to <main>: the storefront footer also shows the market name
    // (PickupStrip/Footer), so an unscoped getByText("Weekly Market") is
    // ambiguous (strict-mode violation).
    const main = page.getByRole("main");

    await expect(main.getByText("Hoop Earrings")).toBeVisible();
    await expect(main.getByText("Heart Pendant")).toBeVisible();
    await expect(main.getByText("Sold out — refunded")).toBeVisible();
    await expect(main.getByText("Weekly Market")).toBeVisible();
    // Both marketAddress and pickupInstructionsEn are the seeded 'TBD'
    // placeholder (DECISIONS.md "Market details: placeholders until Phase
    // 9") — .first() just confirms at least one renders.
    await expect(main.getByText("TBD", { exact: true }).first()).toBeVisible();
    await expect(main.getByText("order-e2e@example.com")).toBeVisible();
  });

  test("shows items and pickup instructions in French", async ({ page }) => {
    await page.goto(`/fr/order/${sessionId}`);
    const main = page.getByRole("main");

    await expect(main.getByText("Hoop Earrings")).toBeVisible();
    await expect(main.getByText("Épuisé — remboursé")).toBeVisible();
    await expect(main.getByText("Weekly Market")).toBeVisible();
    await expect(main.getByText("À déterminer")).toBeVisible();
  });

  test("shows a confirming state for an unknown session id, never a 404", async ({ page }) => {
    await page.goto("/en/order/cs_test_does_not_exist");
    await expect(page.getByText("Confirming your payment…")).toBeVisible();
  });
});
