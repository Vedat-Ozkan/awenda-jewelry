import { describe, expect, it } from "vitest";
import type Stripe from "stripe";
import { buildCheckoutSessionParams, type CheckoutSessionLine } from "./build-session";

// `custom_text.submit` is typed `"" | Submit` (Stripe's Emptyable<T>) since
// the params also accept "" to clear the field; buildCheckoutSessionParams
// only ever sets an object or leaves the whole `custom_text` key unset.
function submitMessage(params: Stripe.Checkout.SessionCreateParams): string | undefined {
  const submit = params.custom_text?.submit;
  return submit && typeof submit === "object" ? submit.message : undefined;
}

const baseLine: CheckoutSessionLine = {
  variantId: "11111111-1111-4111-8111-111111111111",
  qty: 1,
  name: "Silver Necklace",
  variantLabel: "18\"",
  unitAmountCents: 4500,
  imageUrl: "https://example.com/photo.jpg",
};

const baseSettings = {
  shippingFlatCents: 1200,
  freeShippingThresholdCents: 10000,
  stripeTaxEnabled: false,
};

// buildCheckoutSessionParams no longer resolves any copy itself (the route
// does, via next-intl) — these stand in for whatever getTranslations()
// would have returned, with the English "pickup"/French "cueillette" words
// still present so the "pure passthrough" tests below can sanity-check they
// landed in the right field.
const baseCopy = {
  pickupMessage: "We'll email you once your order is ready for pickup.",
  shippingLabel: "Shipping",
  freeShippingLabel: "Free shipping",
};

const frCopy = {
  pickupMessage: "Votre commande sera prête pour la cueillette au marché le 3 octobre 2026.",
  shippingLabel: "Livraison",
  freeShippingLabel: "Livraison gratuite",
};

function build(overrides: Partial<Parameters<typeof buildCheckoutSessionParams>[0]> = {}) {
  return buildCheckoutSessionParams({
    lines: [baseLine],
    fulfillment: "pickup",
    locale: "en",
    settings: baseSettings,
    siteUrl: "http://localhost:3000",
    copy: baseCopy,
    ...overrides,
  });
}

describe("buildCheckoutSessionParams", () => {
  it("builds a pickup session with no shipping fields", () => {
    const params = build({ fulfillment: "pickup" });
    expect(params.shipping_address_collection).toBeUndefined();
    expect(params.shipping_options).toBeUndefined();
    expect(submitMessage(params)).toMatch(/pickup/i);
  });

  it("builds a ship session with Canada-only address collection and a flat rate", () => {
    const params = build({ fulfillment: "ship", lines: [{ ...baseLine, qty: 1 }] });
    expect(params.shipping_address_collection).toEqual({ allowed_countries: ["CA"] });
    expect(params.custom_text).toBeUndefined();
    const options = params.shipping_options!;
    expect(options).toHaveLength(1);
    const rate = options[0].shipping_rate_data!;
    expect(rate.fixed_amount).toEqual({ amount: 1200, currency: "cad" });
    expect(rate.display_name).toBe("Shipping");
  });

  it("charges free shipping when subtotal is exactly at the threshold", () => {
    // unitAmountCents 4500 * qty 1 = 4500; bump qty so subtotal hits exactly 10000.
    const params = build({
      fulfillment: "ship",
      lines: [{ ...baseLine, qty: 1, unitAmountCents: 10000 }],
    });
    const rate = params.shipping_options![0].shipping_rate_data!;
    expect(rate.fixed_amount).toEqual({ amount: 0, currency: "cad" });
    expect(rate.display_name).toBe("Free shipping");
  });

  it("charges flat shipping just below the threshold", () => {
    const params = build({
      fulfillment: "ship",
      lines: [{ ...baseLine, qty: 1, unitAmountCents: 9999 }],
    });
    const rate = params.shipping_options![0].shipping_rate_data!;
    expect(rate.fixed_amount?.amount).toBe(1200);
  });

  it("reflects the Stripe Tax flag", () => {
    expect(build({ settings: { ...baseSettings, stripeTaxEnabled: true } }).automatic_tax).toEqual({
      enabled: true,
    });
    expect(build({ settings: { ...baseSettings, stripeTaxEnabled: false } }).automatic_tax).toEqual({
      enabled: false,
    });
  });

  it("passes translated copy straight through for the pickup message and shipping display name", () => {
    // The actual EN/FR translation lookup (messages/{en,fr}.json "checkout")
    // happens in the route via next-intl, not here — this only checks
    // buildCheckoutSessionParams doesn't mangle whatever `copy` it's given.
    const pickup = build({ fulfillment: "pickup", locale: "fr", copy: frCopy });
    expect(submitMessage(pickup)).toBe(frCopy.pickupMessage);

    const ship = build({ fulfillment: "ship", locale: "fr", copy: frCopy });
    expect(ship.shipping_options![0].shipping_rate_data!.display_name).toBe("Livraison");

    const freeShip = build({
      fulfillment: "ship",
      locale: "fr",
      copy: frCopy,
      lines: [{ ...baseLine, unitAmountCents: 10000 }],
    });
    expect(freeShip.shipping_options![0].shipping_rate_data!.display_name).toBe("Livraison gratuite");
  });

  it("sets expires_at roughly 31 minutes out (30 min minimum + clock-skew slack)", () => {
    const before = Math.floor(Date.now() / 1000);
    const params = build();
    const after = Math.floor(Date.now() / 1000);
    expect(params.expires_at).toBeGreaterThanOrEqual(before + 30 * 60 + 60);
    expect(params.expires_at).toBeLessThanOrEqual(after + 30 * 60 + 60 + 2);
  });

  it("includes fulfillment, locale, and a compact lines JSON in metadata", () => {
    const params = build({ fulfillment: "pickup", locale: "en", lines: [baseLine, { ...baseLine, variantId: "22222222-2222-4222-8222-222222222222", qty: 2 }] });
    expect(params.metadata).toEqual({
      fulfillment: "pickup",
      locale: "en",
      lines: JSON.stringify([
        { variantId: baseLine.variantId, qty: baseLine.qty },
        { variantId: "22222222-2222-4222-8222-222222222222", qty: 2 },
      ]),
    });
  });

  it("builds line_items with cad price_data and an optional image", () => {
    const params = build();
    expect(params.line_items).toEqual([
      {
        price_data: {
          currency: "cad",
          unit_amount: 4500,
          product_data: { name: 'Silver Necklace — 18"', images: ["https://example.com/photo.jpg"] },
        },
        quantity: 1,
      },
    ]);
  });
});
