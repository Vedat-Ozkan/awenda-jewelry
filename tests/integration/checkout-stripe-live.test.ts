import { describe, expect, it, vi } from "vitest";

// Hits the real Stripe test API — skipped cleanly wherever STRIPE_SECRET_KEY
// isn't set (CI and local runs both pass without keys; the owner is still
// creating the Stripe test account — DECISIONS.md "Payment processor stays
// Stripe"). Run locally once a test key exists:
//   STRIPE_SECRET_KEY=sk_test_... pnpm test tests/integration/checkout-stripe-live.test.ts
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

const { buildCheckoutSessionParams } = await import("@/lib/checkout/build-session");
const { getStripeClient } = await import("@/lib/stripe");

describe.skipIf(!process.env.STRIPE_SECRET_KEY)("Stripe test API (real network call)", () => {
  it("creates a real Checkout Session from buildCheckoutSessionParams' output", async () => {
    const params = buildCheckoutSessionParams({
      lines: [
        {
          variantId: "11111111-1111-4111-8111-111111111111",
          qty: 1,
          name: "Test Necklace",
          variantLabel: "18\"",
          unitAmountCents: 1800,
          imageUrl: null,
        },
      ],
      fulfillment: "pickup",
      locale: "en",
      settings: { shippingFlatCents: 1200, freeShippingThresholdCents: 10000, stripeTaxEnabled: false },
      siteUrl: "http://localhost:3000",
      copy: {
        pickupMessage: "We'll email you once your order is ready for pickup.",
        shippingLabel: "Shipping",
        freeShippingLabel: "Free shipping",
      },
    });

    const session = await getStripeClient().checkout.sessions.create(params);
    expect(session.id).toMatch(/^cs_/);
    expect(session.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
    expect(session.mode).toBe("payment");
    expect(session.livemode).toBe(false);
  });
});
