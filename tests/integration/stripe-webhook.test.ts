import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { clearCapturedEmails, readCapturedEmails } from "@/lib/email/capture";
import { createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

// Env schema (src/lib/env.ts) validates on first access — same setup as
// tests/integration/checkout-route.test.ts. STRIPE_SECRET_KEY is a dummy:
// stripe.webhooks.constructEventAsync verifies signatures with local Web
// Crypto only, no network call, so a real key isn't needed for that. What
// *is* real is the signing: generateTestHeaderString below signs with the
// same WEBHOOK_SECRET the route verifies against (06-checkout-orders.md
// step 3 verify — "posting events signed with
// stripe.webhooks.generateTestHeaderString").
const { API_URL, SERVICE_ROLE_KEY } = getSupabaseEnv();
const WEBHOOK_SECRET = "whsec_test_secret";
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "test-anon-key");
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY);
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
// Forces sendEmail() (src/lib/email/send.ts) onto the tmp/emails capture
// path regardless of what a developer's shell happens to export.
vi.stubEnv("RESEND_API_KEY", "");

// `@/lib/supabase/admin` imports `server-only` (throws outside a Next.js
// server bundle) — swapped for the real local-Supabase service client, same
// pattern as tests/integration/catalog-queries.test.ts. The webhook route
// and src/lib/email/orders.tsx both go through this module.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));

const { POST } = await import("@/app/api/stripe/webhook/route");
const { getStripeClient } = await import("@/lib/stripe");

const stripe = getStripeClient();
const retrieveSpy = vi.spyOn(stripe.checkout.sessions, "retrieve");
const refundSpy = vi.spyOn(stripe.refunds, "create");

const supabase = createServiceClient();
const prefix = `test-webhook-${randomUUID().slice(0, 8)}`;
const sessionIdPrefix = `cs_test_${prefix}`;

beforeEach(async () => {
  retrieveSpy.mockReset();
  refundSpy.mockReset().mockResolvedValue({ id: "re_test" } as unknown as Stripe.Response<Stripe.Refund>);
  await clearCapturedEmails();
});

async function createDesignWithVariant(qty: number) {
  const slug = `${prefix}-${randomUUID().slice(0, 8)}`;
  const { data: design, error: designError } = await supabase
    .from("designs")
    .insert({ slug, category: "ring", name_en: `${slug} Ring`, price_cents: 1800, status: "active" })
    .select("id")
    .single();
  if (designError) throw designError;
  const { data: variant, error: variantError } = await supabase
    .from("variants")
    .insert({ design_id: design.id, label: "7", qty_on_hand: qty })
    .select("id")
    .single();
  if (variantError) throw variantError;
  return { designId: design.id as string, variantId: variant.id as string };
}

function retrieveResult(unitAmounts: number[]) {
  return {
    line_items: { data: unitAmounts.map((unit_amount) => ({ price: { unit_amount } })) },
  } as unknown as Stripe.Response<Stripe.Checkout.Session>;
}

function fakeSession(overrides: Record<string, unknown>) {
  return {
    object: "checkout.session",
    payment_status: "paid",
    customer_details: { name: "Jane Doe", email: "jane@example.com", phone: "+15551234567" },
    collected_information: null,
    amount_subtotal: 1800,
    amount_total: 1800,
    total_details: { amount_shipping: 0, amount_tax: 0, amount_discount: 0 },
    payment_intent: `pi_${randomUUID().slice(0, 8)}`,
    metadata: { fulfillment: "pickup", locale: "en" },
    ...overrides,
  };
}

function signedRequest(type: string, session: Record<string, unknown>): Request {
  const payload = JSON.stringify({
    id: `evt_${randomUUID()}`,
    object: "event",
    type,
    data: { object: session },
  });
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: { "stripe-signature": header },
    body: payload,
  });
}

afterAll(async () => {
  // orders.stripe_checkout_session_id -> order_items cascades (0002_core.sql);
  // inventory_movements.variant_id has no cascade, so it must be cleared
  // before the design delete cascades into variants (same as
  // tests/integration/inventory.test.ts).
  await supabase.from("orders").delete().like("stripe_checkout_session_id", `${sessionIdPrefix}%`);
  const { data: designs } = await supabase.from("designs").select("id").like("slug", `${prefix}-%`);
  const designIds = (designs ?? []).map((d) => d.id);
  if (designIds.length > 0) {
    const { data: variants } = await supabase.from("variants").select("id").in("design_id", designIds);
    const variantIds = (variants ?? []).map((v) => v.id);
    if (variantIds.length > 0) {
      await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
    }
  }
  await supabase.from("designs").delete().like("slug", `${prefix}-%`);
});

describe("POST /api/stripe/webhook", () => {
  it("creates an order, decrements stock, and sends a confirmation email", async () => {
    const { variantId } = await createDesignWithVariant(3);
    const sessionId = `${sessionIdPrefix}-normal`;
    retrieveSpy.mockResolvedValue(retrieveResult([1800]));

    const res = await POST(
      signedRequest(
        "checkout.session.completed",
        fakeSession({ id: sessionId, metadata: { fulfillment: "pickup", locale: "en", lines: JSON.stringify([{ variantId, qty: 1 }]) } }),
      ),
    );
    expect(res.status).toBe(200);

    const { data: order } = await supabase.from("orders").select("*").eq("stripe_checkout_session_id", sessionId).single();
    expect(order?.status).toBe("awaiting_pickup");
    expect(order?.customer_email).toBe("jane@example.com");

    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order!.id);
    expect(items).toHaveLength(1);
    expect(items![0].fulfilled).toBe(true);

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(2);

    const { data: movements } = await supabase.from("inventory_movements").select("*").eq("variant_id", variantId);
    expect(movements).toHaveLength(1);
    expect(movements![0].reason).toBe("online_order");

    const emails = await readCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].to).toBe("jane@example.com");
  });

  it("is idempotent on duplicate delivery — one order, one email", async () => {
    const { variantId } = await createDesignWithVariant(3);
    const sessionId = `${sessionIdPrefix}-dup`;
    retrieveSpy.mockResolvedValue(retrieveResult([1800]));
    const request = () =>
      signedRequest(
        "checkout.session.completed",
        fakeSession({ id: sessionId, metadata: { fulfillment: "pickup", locale: "en", lines: JSON.stringify([{ variantId, qty: 1 }]) } }),
      );

    const first = await POST(request());
    expect(first.status).toBe(200);
    const second = await POST(request());
    expect(second.status).toBe(200);

    const { data: orders } = await supabase.from("orders").select("id").eq("stripe_checkout_session_id", sessionId);
    expect(orders).toHaveLength(1);

    const emails = await readCapturedEmails();
    expect(emails).toHaveLength(1);
  });

  it("partially refunds a line that's out of stock and keeps the rest of the order", async () => {
    const { variantId: okVariantId } = await createDesignWithVariant(2);
    const { variantId: soldOutVariantId } = await createDesignWithVariant(0);
    const sessionId = `${sessionIdPrefix}-partial`;
    retrieveSpy.mockResolvedValue(retrieveResult([1800, 1800]));

    const res = await POST(
      signedRequest(
        "checkout.session.completed",
        fakeSession({
          id: sessionId,
          amount_subtotal: 3600,
          amount_total: 3600,
          metadata: {
            fulfillment: "pickup",
            locale: "en",
            lines: JSON.stringify([
              { variantId: okVariantId, qty: 1 },
              { variantId: soldOutVariantId, qty: 1 },
            ]),
          },
        }),
      ),
    );
    expect(res.status).toBe(200);

    const { data: order } = await supabase.from("orders").select("*").eq("stripe_checkout_session_id", sessionId).single();
    // Not fully refunded — one line still shipped/is pickup-ready.
    expect(order?.status).toBe("awaiting_pickup");

    const { data: items } = await supabase.from("order_items").select("*").eq("order_id", order!.id).order("qty");
    const fulfilledFlags = items!.map((i) => i.fulfilled).sort();
    expect(fulfilledFlags).toEqual([false, true]);

    expect(refundSpy).toHaveBeenCalledTimes(1);
    expect(refundSpy).toHaveBeenCalledWith(expect.objectContaining({ amount: 1800 }));

    const { data: okVariant } = await supabase.from("variants").select("qty_on_hand").eq("id", okVariantId).single();
    expect(okVariant?.qty_on_hand).toBe(1);

    const emails = await readCapturedEmails();
    expect(emails).toHaveLength(1);
    expect(emails[0].subject).toMatch(/refund/i);
  });

  it("fulfills exactly one of two concurrent webhooks for the last unit", async () => {
    const { variantId } = await createDesignWithVariant(1);
    const sessionIdA = `${sessionIdPrefix}-race-a`;
    const sessionIdB = `${sessionIdPrefix}-race-b`;
    retrieveSpy.mockResolvedValue(retrieveResult([1800]));

    const [resA, resB] = await Promise.all([
      POST(
        signedRequest(
          "checkout.session.completed",
          fakeSession({
            id: sessionIdA,
            customer_details: { name: "Race A", email: "race-a@example.com", phone: null },
            metadata: { fulfillment: "pickup", locale: "en", lines: JSON.stringify([{ variantId, qty: 1 }]) },
          }),
        ),
      ),
      POST(
        signedRequest(
          "checkout.session.completed",
          fakeSession({
            id: sessionIdB,
            customer_details: { name: "Race B", email: "race-b@example.com", phone: null },
            metadata: { fulfillment: "pickup", locale: "en", lines: JSON.stringify([{ variantId, qty: 1 }]) },
          }),
        ),
      ),
    ]);
    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const { data: orders } = await supabase
      .from("orders")
      .select("id, status")
      .in("stripe_checkout_session_id", [sessionIdA, sessionIdB]);
    expect(orders).toHaveLength(2);

    const { data: allItems } = await supabase
      .from("order_items")
      .select("fulfilled")
      .in(
        "order_id",
        orders!.map((o) => o.id),
      );
    const fulfilledCount = allItems!.filter((i) => i.fulfilled).length;
    expect(fulfilledCount).toBe(1);

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(0);

    expect(refundSpy).toHaveBeenCalledTimes(1);
  });

  // BLOCKER fix: checkout.session.completed can fire for a delayed payment
  // method (e.g. some bank debits) before the money has actually arrived —
  // payment_status is "unpaid" until the later async_payment_succeeded (or
  // async_payment_failed). Must not create an order on that first event.
  it("does not create an order when checkout.session.completed fires with payment_status unpaid", async () => {
    const { variantId } = await createDesignWithVariant(3);
    const sessionId = `${sessionIdPrefix}-unpaid`;

    const res = await POST(
      signedRequest(
        "checkout.session.completed",
        fakeSession({
          id: sessionId,
          payment_status: "unpaid",
          metadata: { fulfillment: "pickup", locale: "en", lines: JSON.stringify([{ variantId, qty: 1 }]) },
        }),
      ),
    );
    expect(res.status).toBe(200);
    expect(retrieveSpy).not.toHaveBeenCalled();

    const { data: orders } = await supabase.from("orders").select("id").eq("stripe_checkout_session_id", sessionId);
    expect(orders).toHaveLength(0);

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(3);

    const emails = await readCapturedEmails();
    expect(emails).toHaveLength(0);
  });

  it("leaves the order awaiting_* (not refunded) when the Stripe refund call fails", async () => {
    const { variantId: soldOutVariantId } = await createDesignWithVariant(0);
    const sessionId = `${sessionIdPrefix}-refund-fails`;
    retrieveSpy.mockResolvedValue(retrieveResult([1800]));
    refundSpy.mockRejectedValueOnce(new Error("stripe down"));

    const res = await POST(
      signedRequest(
        "checkout.session.completed",
        fakeSession({
          id: sessionId,
          metadata: {
            fulfillment: "pickup",
            locale: "en",
            lines: JSON.stringify([{ variantId: soldOutVariantId, qty: 1 }]),
          },
        }),
      ),
    );
    expect(res.status).toBe(200);

    const { data: order } = await supabase.from("orders").select("*").eq("stripe_checkout_session_id", sessionId).single();
    // Fully unfulfilled, but the refund call itself failed — must NOT be
    // marked refunded (the admin needs to see this needs a manual refund).
    expect(order?.status).toBe("awaiting_pickup");
    expect(order?.refunded_at).toBeNull();

    const { data: items } = await supabase.from("order_items").select("fulfilled").eq("order_id", order!.id);
    expect(items!.every((i) => !i.fulfilled)).toBe(true);

    // Must never tell the customer they were refunded when the Stripe call
    // itself failed — no email of any kind goes out here.
    const emails = await readCapturedEmails();
    expect(emails).toHaveLength(0);
  });

  it("rejects a request with an invalid signature and creates no order", async () => {
    const sessionId = `${sessionIdPrefix}-badsig`;
    const payload = JSON.stringify({
      id: `evt_${randomUUID()}`,
      object: "event",
      type: "checkout.session.completed",
      data: { object: fakeSession({ id: sessionId }) },
    });
    const res = await POST(
      new Request("http://localhost/api/stripe/webhook", {
        method: "POST",
        headers: { "stripe-signature": "t=1,v1=deadbeef" },
        body: payload,
      }),
    );
    expect(res.status).toBe(400);

    const { data: orders } = await supabase.from("orders").select("id").eq("stripe_checkout_session_id", sessionId);
    expect(orders).toHaveLength(0);
  });

  it("rejects a request with no signature header", async () => {
    const res = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(res.status).toBe(400);
  });
});
