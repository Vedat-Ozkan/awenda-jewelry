import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { z } from "zod";
import type { Locale } from "@/i18n/routing";
import { localize } from "@/lib/catalog/localize";
import { env } from "@/lib/env";
import { sendOrderConfirmation, sendRefundNotice } from "@/lib/email/orders";
import { getStripeClient } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";

const linesSchema = z.array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }));

type AdminClient = ReturnType<typeof createAdminClient>;

interface CreateOrderResult {
  order_id: string;
  existing: boolean;
  unfulfilled_item_ids: string[];
}

function toLocale(value: string | undefined): Locale {
  return value === "fr" ? "fr" : "en";
}

// The webhook payload's `metadata.lines` only carries { variantId, qty }
// (src/lib/checkout/build-session.ts) — the item's name/variant label are
// looked up fresh here rather than trusting the client, matching the price
// re-validation /api/checkout already does.
async function buildOrderItemsPayload(
  admin: AdminClient,
  lines: { variantId: string; qty: number }[],
  locale: Locale,
  lineItems: Stripe.LineItem[],
) {
  const variantIds = lines.map((line) => line.variantId);
  const { data: variantRows, error: variantsError } = await admin
    .from("variants")
    .select("id, label, design_id")
    .in("id", variantIds);
  if (variantsError) throw variantsError;
  const variantMap = new Map((variantRows ?? []).map((row) => [row.id, row]));

  const designIds = [...new Set([...variantMap.values()].map((row) => row.design_id))];
  const { data: designRows, error: designsError } = await admin
    .from("designs")
    .select("id, name_en, name_fr, description_en, description_fr, material_en, material_fr")
    .in("id", designIds);
  if (designsError) throw designsError;
  const designMap = new Map((designRows ?? []).map((row) => [row.id, row]));

  return lines.map((line, i) => {
    const variant = variantMap.get(line.variantId);
    const design = variant ? designMap.get(variant.design_id) : undefined;
    return {
      // null (not line.variantId) when the variant no longer exists — the
      // client-supplied id would otherwise violate order_items' FK and turn
      // every retry of this event into a permanent 500.
      variant_id: variant ? variant.id : null,
      design_id: variant?.design_id ?? null,
      name_snapshot: design ? localize(design, locale).name : "",
      variant_label_snapshot: variant?.label ?? "",
      // Amount actually charged (the ad-hoc Stripe Price created at
      // checkout), not the design's current price — the two can drift if
      // the owner reprices the design before the webhook lands.
      unit_price_cents: lineItems[i]?.price?.unit_amount ?? 0,
      qty: line.qty,
    };
  });
}

// checkout.session.completed / async_payment_succeeded handler
// (06-checkout-orders.md step 3): retrieves the session's line items for the
// amount actually paid, calls create_order_from_checkout() (atomic order +
// items + inventory decrement, 0009_create_order_from_checkout.sql), then
// refunds and emails based on the result.
async function handleCompletedSession(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = session.metadata ?? {};
  const fulfillment = metadata.fulfillment === "ship" ? "ship" : "pickup";
  const locale = toLocale(metadata.locale);

  const linesParsed = linesSchema.safeParse(JSON.parse(metadata.lines ?? "[]"));
  if (!linesParsed.success) {
    console.error("stripe webhook: unreadable metadata.lines", session.id, linesParsed.error);
    return;
  }
  const lines = linesParsed.data;

  const stripe = getStripeClient();
  const retrieved = await stripe.checkout.sessions.retrieve(session.id, { expand: ["line_items"] });
  const lineItems = retrieved.line_items?.data ?? [];

  const admin = createAdminClient();
  const items = await buildOrderItemsPayload(admin, lines, locale, lineItems);

  const paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : (session.payment_intent?.id ?? null);
  const shippingDetails = session.collected_information?.shipping_details ?? null;

  const { data, error } = await admin.rpc("create_order_from_checkout", {
    p_payload: {
      order: {
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: paymentIntentId,
        status: fulfillment === "pickup" ? "awaiting_pickup" : "awaiting_shipment",
        fulfillment,
        locale,
        customer_name: session.customer_details?.name ?? null,
        customer_email: session.customer_details?.email ?? "",
        customer_phone: session.customer_details?.phone ?? null,
        shipping_address: (fulfillment === "ship" ? shippingDetails : null) as unknown as Json,
        subtotal_cents: session.amount_subtotal ?? 0,
        shipping_cents: session.total_details?.amount_shipping ?? 0,
        tax_cents: session.total_details?.amount_tax ?? 0,
        total_cents: session.amount_total ?? 0,
      },
      items,
    },
  });
  if (error) throw error;

  const result = data as unknown as CreateOrderResult;
  // Duplicate delivery of the same event (or a later async_payment_succeeded
  // for the same session) — order + email already handled the first time.
  if (result.existing) return;

  if (result.unfulfilled_item_ids.length === 0) {
    try {
      await sendOrderConfirmation(result.order_id);
    } catch (err) {
      console.error("stripe webhook: order-confirmation email failed", result.order_id, err);
    }
    return;
  }

  // At least one line sold out between checkout and webhook (DECISIONS.md
  // "Inventory decrement timing for online orders") — refund those lines,
  // plus shipping if nothing on the order was fulfillable.
  const { data: unfulfilledItems, error: unfulfilledError } = await admin
    .from("order_items")
    .select("id, unit_price_cents, qty")
    .in("id", result.unfulfilled_item_ids);
  if (unfulfilledError) throw unfulfilledError;

  const fullyUnfulfilled = result.unfulfilled_item_ids.length === items.length;
  const refundAmountCents =
    (unfulfilledItems ?? []).reduce((sum, item) => sum + item.unit_price_cents * item.qty, 0) +
    (fullyUnfulfilled ? (session.total_details?.amount_shipping ?? 0) : 0);

  let refundSucceeded = true;
  try {
    if (paymentIntentId && refundAmountCents > 0) {
      await stripe.refunds.create({ payment_intent: paymentIntentId, amount: refundAmountCents });
    }
  } catch (err) {
    refundSucceeded = false;
    console.error(
      "stripe webhook: refund failed — order left as awaiting_*, needs a manual refund from Stripe",
      result.order_id,
      session.id,
      err,
    );
  }

  // Only mark the order refunded once Stripe actually returned the money —
  // otherwise it's left awaiting_* (all items still fulfilled=false from
  // create_order_from_checkout()) so the admin can see it needs a manual
  // refund from the Stripe dashboard.
  if (fullyUnfulfilled && refundSucceeded) {
    const { error: statusError } = await admin
      .from("orders")
      .update({ status: "refunded", refunded_at: new Date().toISOString() })
      .eq("id", result.order_id);
    if (statusError) console.error("stripe webhook: failed to mark order refunded", result.order_id, statusError);
  }

  // Never tell the customer they were refunded when the Stripe call itself
  // failed — send nothing; the order stays awaiting_* with the lines still
  // unfulfilled, and the admin's manual refund (orders/actions.ts
  // refundOrder) sends its own notice once it actually succeeds.
  if (refundSucceeded) {
    try {
      await sendRefundNotice(result.order_id, result.unfulfilled_item_ids, refundAmountCents);
    } catch (err) {
      console.error("stripe webhook: refund-notice email failed", result.order_id, err);
    }
  }
}

export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature) throw new Error("missing stripe-signature header");
    event = await getStripeClient().webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    console.error("stripe webhook: signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  switch (event.type) {
    // Both events can fire with payment_status !== "paid": `completed` fires
    // even for a delayed payment method still pending (payment_status
    // "unpaid"), and `async_payment_succeeded` is the one that later
    // confirms it — gate both the same way so a still-pending payment never
    // creates an order.
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.payment_status === "paid") {
        await handleCompletedSession(session);
      } else {
        console.error("stripe webhook: session not paid yet, skipping", event.type, session.id, session.payment_status);
      }
      break;
    }
    case "checkout.session.async_payment_failed":
      console.error("stripe webhook: async payment failed", (event.data.object as Stripe.Checkout.Session).id);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
