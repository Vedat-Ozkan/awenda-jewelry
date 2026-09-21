import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import type { Database } from "@/lib/supabase/database.types";
import { createServiceClient } from "../helpers/local-supabase";

// Phase 6 step 6. Same mocking pattern as tests/integration/catalog-actions.test.ts
// and tests/integration/stripe-webhook.test.ts: `@/lib/supabase/admin` swapped
// for the real local-Supabase service-role client, `@/lib/auth` stubbed
// (requireAdminFromCookies() reads cookies via next/headers, unavailable
// outside a request context), `next/cache` stubbed (no render context under
// Vitest). `@/lib/stripe` and `@/lib/email/orders` are mocked at the
// boundary per 06-checkout-orders.md's resolved STOP answer — no Stripe
// test key is available.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdminFromCookies: async () => ({ user: { email: "admin@example.com" }, email: "admin@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

const sendOrderConfirmation = vi.fn();
const sendRefundNotice = vi.fn();
const sendShipped = vi.fn();
vi.mock("@/lib/email/orders", () => ({
  sendOrderConfirmation: (orderId: string) => sendOrderConfirmation(orderId),
  sendRefundNotice: (orderId: string, itemIds: string[], amountCents: number) => sendRefundNotice(orderId, itemIds, amountCents),
  sendShipped: (orderId: string) => sendShipped(orderId),
}));

const refundsCreate = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ refunds: { create: (...args: unknown[]) => refundsCreate(...args) } }),
}));

const { markShipped, markPickedUp, refundOrder, resendEmail } = await import(
  "@/app/(admin)/admin/(shell)/orders/actions"
);

type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

const supabase = createServiceClient();
const prefix = `test-orders-actions-${randomUUID().slice(0, 8)}`;
const createdDesignIds: string[] = [];
const createdOrderIds: string[] = [];

beforeEach(() => {
  sendOrderConfirmation.mockReset().mockResolvedValue(undefined);
  sendRefundNotice.mockReset().mockResolvedValue(undefined);
  sendShipped.mockReset().mockResolvedValue(undefined);
  refundsCreate.mockReset().mockResolvedValue({ id: "re_test" } as unknown as Stripe.Response<Stripe.Refund>);
});

afterAll(async () => {
  if (createdOrderIds.length > 0) {
    await supabase.from("orders").delete().in("id", createdOrderIds); // order_items cascades (0002_core.sql)
  }
  if (createdDesignIds.length > 0) {
    const { data: variants } = await supabase.from("variants").select("id").in("design_id", createdDesignIds);
    const variantIds = (variants ?? []).map((v) => v.id);
    if (variantIds.length > 0) {
      await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
    }
    await supabase.from("designs").delete().in("id", createdDesignIds);
  }
});

async function createVariant(qty: number): Promise<string> {
  const slug = `${prefix}-${randomUUID().slice(0, 8)}`;
  const { data: design, error: designError } = await supabase
    .from("designs")
    .insert({ slug, category: "ring", name_en: `${slug} Ring`, price_cents: 1800, status: "active" })
    .select("id")
    .single();
  if (designError) throw designError;
  createdDesignIds.push(design.id);

  const { data: variant, error: variantError } = await supabase
    .from("variants")
    .insert({ design_id: design.id, label: "7", qty_on_hand: qty })
    .select("id")
    .single();
  if (variantError) throw variantError;
  return variant.id as string;
}

async function createOrder(
  overrides: Partial<OrderInsert>,
  items: { variantId: string; unitPriceCents: number; qty: number; fulfilled?: boolean }[],
): Promise<string> {
  const sessionId = `cs_test_${prefix}-${randomUUID().slice(0, 8)}`;
  const { data: order, error } = await supabase
    .from("orders")
    .insert({
      stripe_checkout_session_id: sessionId,
      status: "awaiting_shipment",
      fulfillment: "ship",
      customer_email: "buyer@example.com",
      subtotal_cents: 1800,
      shipping_cents: 1200,
      tax_cents: 0,
      total_cents: 3000,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw error;
  createdOrderIds.push(order.id);

  const { error: itemsError } = await supabase.from("order_items").insert(
    items.map((item) => ({
      order_id: order.id,
      variant_id: item.variantId,
      name_snapshot: "Test Ring",
      variant_label_snapshot: "7",
      unit_price_cents: item.unitPriceCents,
      qty: item.qty,
      fulfilled: item.fulfilled ?? true,
    })),
  );
  if (itemsError) throw itemsError;

  return order.id as string;
}

describe("orders admin actions", () => {
  it("markShipped sets status/tracking fields and sends the shipped email", async () => {
    const variantId = await createVariant(3);
    const orderId = await createOrder({ status: "awaiting_shipment" }, [{ variantId, unitPriceCents: 1800, qty: 1 }]);

    const result = await markShipped(orderId, { carrier: "canada_post", trackingNumber: "1234567890" });
    expect(result).toEqual({ ok: true });

    const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
    expect(order?.status).toBe("shipped");
    expect(order?.tracking_number).toBe("1234567890");
    expect(order?.tracking_url).toBe(
      "https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=1234567890",
    );
    expect(order?.shipped_at).not.toBeNull();
    expect(sendShipped).toHaveBeenCalledWith(orderId);
  });

  it("rejects markShipped from a status other than awaiting_shipment", async () => {
    const variantId = await createVariant(2);
    const orderId = await createOrder({ status: "awaiting_pickup", fulfillment: "pickup" }, [
      { variantId, unitPriceCents: 1800, qty: 1 },
    ]);

    await expect(markShipped(orderId, { carrier: "ups", trackingNumber: "abc" })).rejects.toThrow(/awaiting_pickup/);
    expect(sendShipped).not.toHaveBeenCalled();
  });

  it("markPickedUp sets status and picked_up_at", async () => {
    const variantId = await createVariant(2);
    const orderId = await createOrder({ status: "awaiting_pickup", fulfillment: "pickup" }, [
      { variantId, unitPriceCents: 1800, qty: 1 },
    ]);

    await markPickedUp(orderId);

    const { data: order } = await supabase.from("orders").select("status, picked_up_at").eq("id", orderId).single();
    expect(order?.status).toBe("picked_up");
    expect(order?.picked_up_at).not.toBeNull();
  });

  it("rejects markPickedUp from a status other than awaiting_pickup", async () => {
    const variantId = await createVariant(2);
    const orderId = await createOrder({ status: "shipped" }, [{ variantId, unitPriceCents: 1800, qty: 1 }]);

    await expect(markPickedUp(orderId)).rejects.toThrow(/shipped/);
  });

  it("refunds one line, restores stock, and leaves the order's status alone while another line stays fulfilled", async () => {
    const variantA = await createVariant(1);
    const variantB = await createVariant(4);
    const orderId = await createOrder(
      { status: "awaiting_shipment", stripe_payment_intent_id: "pi_test_partial", shipping_cents: 1200 },
      [
        { variantId: variantA, unitPriceCents: 1800, qty: 1 },
        { variantId: variantB, unitPriceCents: 2000, qty: 1 },
      ],
    );
    const { data: itemRows } = await supabase.from("order_items").select("id, variant_id").eq("order_id", orderId);
    const itemA = itemRows!.find((i) => i.variant_id === variantA)!;

    const result = await refundOrder(orderId, { itemIds: [itemA.id] });
    expect(result).toEqual({ ok: true });

    // Not a full refund (the other line is still fulfilled) — no shipping.
    expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: "pi_test_partial", amount: 1800 });

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantA).single();
    expect(variant?.qty_on_hand).toBe(2);

    const { data: movements } = await supabase.from("inventory_movements").select("*").eq("variant_id", variantA);
    expect(movements).toHaveLength(1);
    expect(movements![0]).toMatchObject({ reason: "refund", ref_id: orderId, delta: 1 });

    const { data: items } = await supabase.from("order_items").select("id, fulfilled").eq("order_id", orderId);
    expect(items!.find((i) => i.id === itemA.id)?.fulfilled).toBe(false);
    expect(items!.find((i) => i.id !== itemA.id)?.fulfilled).toBe(true);

    const { data: order } = await supabase.from("orders").select("status").eq("id", orderId).single();
    expect(order?.status).toBe("awaiting_shipment");

    expect(sendRefundNotice).toHaveBeenCalledWith(orderId, [itemA.id], 1800);
  });

  it("full refund includes shipping and marks the order refunded", async () => {
    const variantId = await createVariant(0);
    const orderId = await createOrder(
      { status: "awaiting_shipment", stripe_payment_intent_id: "pi_test_full", shipping_cents: 1200 },
      [{ variantId, unitPriceCents: 1800, qty: 1 }],
    );

    const result = await refundOrder(orderId);
    expect(result).toEqual({ ok: true });

    expect(refundsCreate).toHaveBeenCalledWith({ payment_intent: "pi_test_full", amount: 1800 + 1200 });

    const { data: order } = await supabase.from("orders").select("status, refunded_at").eq("id", orderId).single();
    expect(order?.status).toBe("refunded");
    expect(order?.refunded_at).not.toBeNull();

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(1);
  });

  it("refuses to refund an order with no payment intent", async () => {
    const variantId = await createVariant(2);
    const orderId = await createOrder({ status: "awaiting_shipment" }, [{ variantId, unitPriceCents: 1800, qty: 1 }]);

    await expect(refundOrder(orderId)).rejects.toThrow(/no payment/i);
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("resendEmail sends the requested kind", async () => {
    const variantId = await createVariant(2);
    const orderId = await createOrder({ status: "awaiting_shipment" }, [{ variantId, unitPriceCents: 1800, qty: 1 }]);

    const result = await resendEmail(orderId, "confirmation");
    expect(result).toEqual({ ok: true });
    expect(sendOrderConfirmation).toHaveBeenCalledWith(orderId);
  });
});
