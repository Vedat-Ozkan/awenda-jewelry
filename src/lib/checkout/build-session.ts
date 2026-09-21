import type Stripe from "stripe";
import type { Locale } from "@/i18n/routing";
import type { Fulfillment } from "@/lib/cart/types";

// Stripe's minimum Checkout Session lifetime (06-checkout-orders.md step 2).
const SESSION_EXPIRY_SECONDS = 30 * 60;
// Slack so a session doesn't expire from Stripe's clock being a few seconds
// ahead of ours by the time it evaluates expires_at.
const CLOCK_SKEW_SECONDS = 60;

export interface CheckoutSessionLine {
  variantId: string;
  qty: number;
  name: string;
  variantLabel: string;
  unitAmountCents: number;
  imageUrl: string | null;
}

export interface CheckoutSessionSettings {
  shippingFlatCents: number;
  freeShippingThresholdCents: number | null;
  stripeTaxEnabled: boolean;
}

// Already-translated copy — the route resolves these via next-intl's
// getTranslations({locale, namespace: 'checkout'}) (messages/{en,fr}.json
// "checkout") before calling buildCheckoutSessionParams, which stays a pure
// function with no i18n dependency of its own.
export interface CheckoutSessionCopy {
  pickupMessage: string;
  shippingLabel: string;
  freeShippingLabel: string;
}

export interface BuildCheckoutSessionParamsInput {
  lines: CheckoutSessionLine[];
  fulfillment: Fulfillment;
  locale: Locale;
  settings: CheckoutSessionSettings;
  siteUrl: string;
  copy: CheckoutSessionCopy;
}

// Compact JSON the Phase 6 step 3 webhook reads back to know which
// variants/qtys were paid for (Stripe line items alone don't round-trip a
// variant id). Stripe caps metadata values at 500 chars — the route checks
// this against the real request before ever calling Stripe.
export function serializeCheckoutLinesMetadata(lines: { variantId: string; qty: number }[]): string {
  return JSON.stringify(lines.map((line) => ({ variantId: line.variantId, qty: line.qty })));
}

// Pure: turns already-validated, already-repriced lines into Stripe
// Checkout Session params. No I/O — src/app/api/checkout/route.ts does the
// DB re-pricing/validation and calls stripe.checkout.sessions.create(
// buildCheckoutSessionParams(...)).
export function buildCheckoutSessionParams(
  input: BuildCheckoutSessionParamsInput,
): Stripe.Checkout.SessionCreateParams {
  const { lines, fulfillment, locale, settings, siteUrl, copy } = input;

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitAmountCents * line.qty, 0);
  const freeShipping =
    settings.freeShippingThresholdCents != null && subtotalCents >= settings.freeShippingThresholdCents;

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = lines.map((line) => ({
    price_data: {
      currency: "cad",
      unit_amount: line.unitAmountCents,
      product_data: {
        name: `${line.name} — ${line.variantLabel}`,
        ...(line.imageUrl ? { images: [line.imageUrl] } : {}),
      },
    },
    quantity: line.qty,
  }));

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    locale,
    line_items,
    automatic_tax: { enabled: settings.stripeTaxEnabled },
    phone_number_collection: { enabled: true },
    success_url: `${siteUrl}/${locale}/order/{CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/${locale}/cart`,
    expires_at: Math.floor(Date.now() / 1000) + SESSION_EXPIRY_SECONDS + CLOCK_SKEW_SECONDS,
    metadata: {
      fulfillment,
      locale,
      lines: serializeCheckoutLinesMetadata(lines),
    },
  };

  if (fulfillment === "pickup") {
    params.custom_text = { submit: { message: copy.pickupMessage } };
  } else {
    params.shipping_address_collection = { allowed_countries: ["CA"] };
    params.shipping_options = [
      {
        shipping_rate_data: {
          type: "fixed_amount",
          fixed_amount: { amount: freeShipping ? 0 : settings.shippingFlatCents, currency: "cad" },
          display_name: freeShipping ? copy.freeShippingLabel : copy.shippingLabel,
        },
      },
    ];
  }

  return params;
}
