"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminFromCookies } from "@/lib/auth";
import { sendOrderConfirmation, sendRefundNotice, sendShipped } from "@/lib/email/orders";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { CARRIERS, type Carrier } from "./carriers";

// Orders admin (Phase 6 step 6): markShipped/markPickedUp/refundOrder/
// resendEmail. Email failures are caught (never fail the underlying DB
// change) and reported back as `{ ok: true, emailFailed: true }` so the UI
// can say "saved, but email failed — use Resend" per 06-checkout-orders.md
// step 6.
const CARRIER_VALUES = CARRIERS.map((c) => c.value) as [Carrier, ...Carrier[]];

function revalidateOrder(orderId: string): void {
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin/orders");
}

function trackingUrlFor(carrier: Carrier, trackingNumber: string): string | null {
  const n = encodeURIComponent(trackingNumber);
  switch (carrier) {
    case "canada_post":
      return `https://www.canadapost-postescanada.ca/track-reperage/en#/search?searchFor=${n}`;
    case "ups":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "purolator":
      return `https://www.purolator.com/en/shipping/tracker?pin=${n}`;
    case "fedex":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "other":
      return null;
  }
}

const markShippedSchema = z.object({
  carrier: z.enum(CARRIER_VALUES),
  trackingNumber: z.string().min(1),
});

export async function markShipped(
  orderId: string,
  data: { carrier: Carrier; trackingNumber: string },
): Promise<{ ok: true; emailFailed?: boolean }> {
  await requireAdminFromCookies();
  z.string().uuid().parse(orderId);
  const parsed = markShippedSchema.parse(data);
  const supabase = createAdminClient();

  const { data: order, error: fetchError } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (fetchError) throw fetchError;
  if (order.status !== "awaiting_shipment") {
    throw new Error(`Cannot mark shipped from status "${order.status}"`);
  }

  const { error } = await supabase
    .from("orders")
    .update({
      status: "shipped",
      shipped_at: new Date().toISOString(),
      tracking_number: parsed.trackingNumber,
      tracking_url: trackingUrlFor(parsed.carrier, parsed.trackingNumber),
    })
    .eq("id", orderId);
  if (error) throw error;

  revalidateOrder(orderId);

  try {
    await sendShipped(orderId);
    return { ok: true };
  } catch (err) {
    console.error("markShipped: sendShipped failed", orderId, err);
    return { ok: true, emailFailed: true };
  }
}

export async function markPickedUp(orderId: string): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(orderId);
  const supabase = createAdminClient();

  const { data: order, error: fetchError } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (fetchError) throw fetchError;
  if (order.status !== "awaiting_pickup") {
    throw new Error(`Cannot mark picked up from status "${order.status}"`);
  }

  const { error } = await supabase
    .from("orders")
    .update({ status: "picked_up", picked_up_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw error;

  revalidateOrder(orderId);
}

// e2e (06-checkout-orders.md step 6) runs against the local dev server with
// no real Stripe key, so a signed opt-in flag skips the real API call.
// Double-gated on NODE_ENV so it can never fire in production regardless of
// how the env var ends up set there.
function shouldFakeRefund(): boolean {
  return process.env.NODE_ENV !== "production" && process.env.STRIPE_FAKE_REFUNDS === "1";
}

const refundSchema = z.object({ itemIds: z.array(z.string().uuid()).optional() });

// Full refund (no itemIds) or per-line. Amount = the selected still-fulfilled
// items, plus shipping when the selection covers every currently-fulfilled
// item on the order. Stripe first, then the DB via refund_order_items() —
// if the DB call fails after Stripe already succeeded, that's logged loudly
// (the money has moved; the ledger/stock did not) and the error still
// propagates so the admin UI shows failure.
export async function refundOrder(orderId: string, data?: { itemIds?: string[] }): Promise<{ ok: true; emailFailed?: boolean }> {
  await requireAdminFromCookies();
  z.string().uuid().parse(orderId);
  const parsed = refundSchema.parse(data ?? {});
  const supabase = createAdminClient();

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select("stripe_payment_intent_id, shipping_cents")
    .eq("id", orderId)
    .single();
  if (orderError) throw orderError;
  if (!order.stripe_payment_intent_id) throw new Error("Order has no payment to refund");

  const { data: items, error: itemsError } = await supabase
    .from("order_items")
    .select("id, unit_price_cents, qty, fulfilled")
    .eq("order_id", orderId);
  if (itemsError) throw itemsError;

  const fulfilledItems = items.filter((item) => item.fulfilled);
  const targetItems = parsed.itemIds ? fulfilledItems.filter((item) => parsed.itemIds!.includes(item.id)) : fulfilledItems;
  if (targetItems.length === 0) throw new Error("Nothing to refund");

  const isFullRefund = targetItems.length === fulfilledItems.length;
  const amountCents =
    targetItems.reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0) + (isFullRefund ? order.shipping_cents : 0);

  const refund = shouldFakeRefund()
    ? { id: `re_fake_${crypto.randomUUID()}` }
    : await getStripeClient().refunds.create({ payment_intent: order.stripe_payment_intent_id, amount: amountCents });

  const { error: rpcError } = await supabase.rpc("refund_order_items", {
    p_order_id: orderId,
    p_item_ids: targetItems.map((item) => item.id),
  });
  if (rpcError) {
    console.error("refundOrder: Stripe refund succeeded but the DB update failed", orderId, refund.id, rpcError);
    throw rpcError;
  }

  revalidateOrder(orderId);

  try {
    await sendRefundNotice(
      orderId,
      targetItems.map((item) => item.id),
      amountCents,
    );
    return { ok: true };
  } catch (err) {
    console.error("refundOrder: sendRefundNotice failed", orderId, err);
    return { ok: true, emailFailed: true };
  }
}

const emailKindSchema = z.enum(["confirmation", "shipped", "refund"]);

export async function resendEmail(orderId: string, kind: "confirmation" | "shipped" | "refund"): Promise<{ ok: boolean }> {
  await requireAdminFromCookies();
  z.string().uuid().parse(orderId);
  const parsedKind = emailKindSchema.parse(kind);

  try {
    if (parsedKind === "confirmation") {
      await sendOrderConfirmation(orderId);
    } else if (parsedKind === "shipped") {
      await sendShipped(orderId);
    } else {
      // There's no record of which refund (webhook auto-refund, or one of
      // possibly several manual per-line refunds) a resend is meant to
      // repeat, so this is the best available reconstruction: every
      // currently-unfulfilled item, for its refund-worthy amount. If more
      // than one refund has happened on this order, the resent email may
      // cover more items/a larger amount than any single original refund did.
      // Also: if the webhook's auto-refund FAILED (order still awaiting_*,
      // lines unfulfilled, money not returned — see the webhook's
      // console.error), this would tell the customer they were refunded.
      // Check the Stripe dashboard before resending a refund notice.
      const supabase = createAdminClient();
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select("status, shipping_cents")
        .eq("id", orderId)
        .single();
      if (orderError) throw orderError;
      const { data: items, error: itemsError } = await supabase
        .from("order_items")
        .select("id, unit_price_cents, qty, fulfilled")
        .eq("order_id", orderId);
      if (itemsError) throw itemsError;

      const unfulfilled = items.filter((item) => !item.fulfilled);
      const amountCents =
        unfulfilled.reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0) +
        (order.status === "refunded" ? order.shipping_cents : 0);
      await sendRefundNotice(
        orderId,
        unfulfilled.map((item) => item.id),
        amountCents,
      );
    }
    return { ok: true };
  } catch (err) {
    console.error("resendEmail: send failed", orderId, parsedKind, err);
    return { ok: false };
  }
}
