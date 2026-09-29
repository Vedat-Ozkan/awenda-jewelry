import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { readCapturedEmails } from "../src/lib/email/capture";
import { createServiceClient } from "../tests/helpers/local-supabase";
import { deleteTestAdmin, loginAsAdmin } from "./helpers/admin";

// Phase 6 step 6. Orders aren't reachable through any UI flow yet (no
// Stripe test key — see 06-checkout-orders.md's "resolved STOP answers"),
// so orders + items are seeded directly via the service client, same as
// e2e/storefront-order.spec.ts and tests/integration/stripe-webhook.test.ts.
// Refunds use STRIPE_FAKE_REFUNDS=1 (playwright.config.ts webServer env) to
// skip the real Stripe call.
const ADMIN_EMAIL = "e2e-orders-admin@example.com";
const prefix = `e2e-orders-${randomUUID().slice(0, 8)}`;

test.describe("admin orders", () => {
  test.describe.configure({ mode: "serial" });

  const shipCustomerEmail = `${prefix}-ship@example.com`;
  const shipCustomerName = `E2E Ship Customer ${prefix}`;
  const pickupCustomerName = `E2E Pickup Customer ${prefix}`;

  const designIds: string[] = [];
  let variantShipAId: string;
  let variantShipBId: string;
  let variantPickupId: string;
  let shipOrderId: string;
  let pickupOrderId: string;

  test.beforeAll(async () => {
    const supabase = createServiceClient();

    async function createVariant(label: string, category: "ring" = "ring", qty = 2) {
      const slug = `${prefix}-${randomUUID().slice(0, 8)}`;
      const { data: design, error: designError } = await supabase
        .from("designs")
        .insert({ slug, category, name_en: `${slug} Ring`, price_cents: 1800, status: "active" })
        .select("id")
        .single();
      if (designError) throw designError;
      designIds.push(design.id);

      const { data: variant, error: variantError } = await supabase
        .from("variants")
        .insert({ design_id: design.id, label, qty_on_hand: qty })
        .select("id")
        .single();
      if (variantError) throw variantError;
      return variant.id as string;
    }

    variantShipAId = await createVariant("7");
    variantShipBId = await createVariant("8");
    variantPickupId = await createVariant("9");

    const { data: shipOrder, error: shipOrderError } = await supabase
      .from("orders")
      .insert({
        stripe_checkout_session_id: `cs_test_${prefix}-ship`,
        stripe_payment_intent_id: `pi_test_${prefix}`,
        status: "awaiting_shipment",
        fulfillment: "ship",
        customer_name: shipCustomerName,
        customer_email: shipCustomerEmail,
        subtotal_cents: 3600,
        shipping_cents: 1200,
        tax_cents: 0,
        total_cents: 4800,
      })
      .select("id")
      .single();
    if (shipOrderError) throw shipOrderError;
    shipOrderId = shipOrder.id;

    const { error: shipItemsError } = await supabase.from("order_items").insert([
      {
        order_id: shipOrderId,
        variant_id: variantShipAId,
        name_snapshot: "Test Ring A",
        variant_label_snapshot: "7",
        unit_price_cents: 1800,
        qty: 1,
      },
      {
        order_id: shipOrderId,
        variant_id: variantShipBId,
        name_snapshot: "Test Ring B",
        variant_label_snapshot: "8",
        unit_price_cents: 1800,
        qty: 1,
      },
    ]);
    if (shipItemsError) throw shipItemsError;

    const { data: pickupOrder, error: pickupOrderError } = await supabase
      .from("orders")
      .insert({
        stripe_checkout_session_id: `cs_test_${prefix}-pickup`,
        status: "awaiting_pickup",
        fulfillment: "pickup",
        customer_name: pickupCustomerName,
        customer_email: `${prefix}-pickup@example.com`,
        subtotal_cents: 1800,
        shipping_cents: 0,
        tax_cents: 0,
        total_cents: 1800,
      })
      .select("id")
      .single();
    if (pickupOrderError) throw pickupOrderError;
    pickupOrderId = pickupOrder.id;

    const { error: pickupItemsError } = await supabase.from("order_items").insert({
      order_id: pickupOrderId,
      variant_id: variantPickupId,
      name_snapshot: "Test Ring C",
      variant_label_snapshot: "9",
      unit_price_cents: 1800,
      qty: 1,
    });
    if (pickupItemsError) throw pickupItemsError;
  });

  test.afterAll(async () => {
    const supabase = createServiceClient();
    await supabase.from("orders").delete().in("id", [shipOrderId, pickupOrderId]); // order_items cascades
    const variantIds = [variantShipAId, variantShipBId, variantPickupId];
    await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
    await supabase.from("designs").delete().in("id", designIds);
    await deleteTestAdmin(ADMIN_EMAIL);
  });

  test("list shows both seeded orders with fulfillment badges", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/orders");

    const shipRow = page.locator("li", { hasText: shipCustomerName });
    await expect(shipRow).toBeVisible();
    await expect(shipRow.getByText("Ship", { exact: true })).toBeVisible();

    const pickupRow = page.locator("li", { hasText: pickupCustomerName });
    await expect(pickupRow).toBeVisible();
    await expect(pickupRow.getByText("Pickup", { exact: true })).toBeVisible();
  });

  test("pickups tab: marking picked up removes the row from the tab", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto("/admin/orders");
    await page.getByRole("button", { name: "Pickups" }).click();

    const pickupRow = page.locator("li", { hasText: pickupCustomerName });
    await expect(pickupRow).toBeVisible();
    await pickupRow.getByRole("button", { name: "Picked up" }).click();
    await expect(pickupRow).toHaveCount(0);

    const supabase = createServiceClient();
    const { data } = await supabase.from("orders").select("status").eq("id", pickupOrderId).single();
    expect(data?.status).toBe("picked_up");
  });

  test("detail: mark shipped sends a tracking email", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto(`/admin/orders/${shipOrderId}`);

    await page.getByLabel("Carrier").selectOption("canada_post");
    await page.getByLabel("Tracking number").fill("1Z999AA10123456784");
    await page.getByRole("button", { name: "Mark shipped" }).click();

    await expect(page.getByRole("button", { name: "Mark shipped" })).toHaveCount(0);
    await expect(page.getByText("1Z999AA10123456784")).toBeVisible();

    const supabase = createServiceClient();
    const { data } = await supabase.from("orders").select("status").eq("id", shipOrderId).single();
    expect(data?.status).toBe("shipped");

    const emails = await readCapturedEmails();
    const shipEmail = emails.find((e) => e.to === shipCustomerEmail && /shipped/i.test(e.subject));
    expect(shipEmail).toBeTruthy();
    expect(shipEmail!.html).toContain("1Z999AA10123456784");
  });

  test("detail: refund one line restores stock and writes a refund movement", async ({ page }) => {
    await loginAsAdmin(page, ADMIN_EMAIL);
    await page.goto(`/admin/orders/${shipOrderId}`);

    await page.getByLabel("Refund Test Ring A — 7").check();
    await page.getByRole("button", { name: "Refund selected" }).click();
    await expect(page.getByText("· refunded")).toBeVisible();

    const supabase = createServiceClient();
    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantShipAId).single();
    expect(variant?.qty_on_hand).toBe(3); // seeded at 2, refund restores +1

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("*")
      .eq("variant_id", variantShipAId)
      .eq("reason", "refund");
    expect(movements).toHaveLength(1);
    expect(movements![0]).toMatchObject({ ref_id: shipOrderId, delta: 1 });
  });
});
