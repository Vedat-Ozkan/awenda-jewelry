import type { Locale } from "@/i18n/routing";
import { formatMarketDate } from "@/lib/catalog/format";
import { sendEmail } from "@/lib/email/send";
import { OrderConfirmationEmail } from "@/lib/email/templates/order-confirmation";
import { PickupReminderEmail } from "@/lib/email/templates/pickup-reminder";
import { RefundNoticeEmail } from "@/lib/email/templates/refund-notice";
import { ShippedEmail } from "@/lib/email/templates/shipped";
import { createAdminClient } from "@/lib/supabase/admin";

// Loads an order + its items via the admin client (bypasses RLS — these run
// server-side only, from the webhook route and later the orders admin/cron,
// 06-checkout-orders.md steps 3/6/8). Not exported: callers go through the
// send*() functions below.
async function loadOrder(orderId: string) {
  const admin = createAdminClient();
  const { data: order, error } = await admin.from("orders").select("*").eq("id", orderId).single();
  if (error) throw error;
  const { data: items, error: itemsError } = await admin.from("order_items").select("*").eq("order_id", orderId);
  if (itemsError) throw itemsError;
  return { order, items: items ?? [] };
}

function toLocale(value: string): Locale {
  return value === "fr" ? "fr" : "en";
}

// Sent by the webhook (step 3) once create_order_from_checkout() reports no
// unfulfilled items.
export async function sendOrderConfirmation(orderId: string): Promise<void> {
  const { order, items } = await loadOrder(orderId);
  const locale = toLocale(order.locale);
  await sendEmail({
    to: order.customer_email,
    subject: locale === "fr" ? "Confirmation de votre commande — Awenda Jewelry" : "Your Awenda Jewelry order confirmation",
    react: (
      <OrderConfirmationEmail
        locale={locale}
        fulfillment={order.fulfillment}
        items={items.map((item) => ({
          name: item.name_snapshot,
          variantLabel: item.variant_label_snapshot,
          qty: item.qty,
          unitPriceCents: item.unit_price_cents,
        }))}
        subtotalCents={order.subtotal_cents}
        shippingCents={order.shipping_cents}
        totalCents={order.total_cents}
      />
    ),
  });
}

// Sent by the webhook (step 3, sold out between checkout and webhook) and
// the orders admin's manual per-line/full refund (step 6, refundOrder in
// src/app/(admin)/admin/(shell)/orders/actions.ts) — both already know
// exactly which order_items they just refunded and for how much, so the
// caller passes those in rather than this function re-deriving them from
// fulfilled=false (which, for the admin path, can include items a *previous*
// refund already flipped, not just this one).
export async function sendRefundNotice(orderId: string, refundedItemIds: string[], refundedAmountCents: number): Promise<void> {
  const { order, items } = await loadOrder(orderId);
  const locale = toLocale(order.locale);
  const refundedItems = items.filter((item) => refundedItemIds.includes(item.id));
  const fullyRefunded = order.status === "refunded";

  await sendEmail({
    to: order.customer_email,
    subject: locale === "fr" ? "Remboursement — Awenda Jewelry" : "Refund notice — Awenda Jewelry",
    react: (
      <RefundNoticeEmail
        locale={locale}
        items={refundedItems.map((item) => ({
          name: item.name_snapshot,
          variantLabel: item.variant_label_snapshot,
          qty: item.qty,
        }))}
        refundAmountCents={refundedAmountCents}
        fullyRefunded={fullyRefunded}
      />
    ),
  });
}

// For the orders admin's "Mark shipped" action (step 6, not this chunk) —
// expects order.tracking_number/tracking_url to already be set.
export async function sendShipped(orderId: string): Promise<void> {
  const { order, items } = await loadOrder(orderId);
  const locale = toLocale(order.locale);
  await sendEmail({
    to: order.customer_email,
    subject: locale === "fr" ? "Votre commande a été expédiée — Awenda Jewelry" : "Your order has shipped — Awenda Jewelry",
    react: (
      <ShippedEmail
        locale={locale}
        items={items
          .filter((item) => item.fulfilled)
          .map((item) => ({ name: item.name_snapshot, variantLabel: item.variant_label_snapshot, qty: item.qty }))}
        trackingNumber={order.tracking_number ?? ""}
        trackingUrl={order.tracking_url}
      />
    ),
  });
}

// For the pickup reminder cron (step 8, not this chunk).
export async function sendPickupReminder(orderId: string): Promise<void> {
  const { order, items } = await loadOrder(orderId);
  const locale = toLocale(order.locale);
  const admin = createAdminClient();
  const [{ data: settings }, { data: nextMarketDate }] = await Promise.all([
    admin.from("settings").select("market_name, market_address, pickup_instructions_en, pickup_instructions_fr").eq("id", 1).maybeSingle(),
    admin.rpc("next_market_date"),
  ]);

  await sendEmail({
    to: order.customer_email,
    subject: locale === "fr" ? "Rappel de cueillette — Awenda Jewelry" : "Pickup reminder — Awenda Jewelry",
    react: (
      <PickupReminderEmail
        locale={locale}
        items={items
          .filter((item) => item.fulfilled)
          .map((item) => ({ name: item.name_snapshot, variantLabel: item.variant_label_snapshot, qty: item.qty }))}
        marketName={settings?.market_name ?? null}
        marketAddress={settings?.market_address ?? null}
        marketDate={nextMarketDate ? formatMarketDate(nextMarketDate, locale) : null}
        pickupInstructions={(locale === "fr" ? settings?.pickup_instructions_fr : settings?.pickup_instructions_en) ?? null}
      />
    ),
  });
}
