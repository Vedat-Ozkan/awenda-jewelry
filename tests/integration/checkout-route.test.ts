import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import en from "../../messages/en.json";
import fr from "../../messages/fr.json";
import { createAnonClient as createLocalAnonClient, createServiceClient, getSupabaseEnv } from "../helpers/local-supabase";

// Env schema (src/lib/env.ts) validates every var on first access — same
// setup as tests/integration/photos-route.test.ts. NEXT_PUBLIC_SUPABASE_URL
// / ANON_KEY point at the real local stack so loadPricingData() (used by
// the route) reads public_designs/public_settings for real, as an anon
// visitor would; SUPABASE_SERVICE_ROLE_KEY is a dummy since the route
// itself never needs it (only this test's own setup/teardown does, via
// createServiceClient()).
const { API_URL, ANON_KEY } = getSupabaseEnv();
vi.stubEnv("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
vi.stubEnv("CRON_SECRET", "test-secret");
vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", API_URL);
vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY);
vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

// `@/lib/catalog/client` imports `server-only` (throws outside a Next.js
// server bundle) — swapped for the local anon client, same pattern as
// tests/integration/catalog-queries.test.ts.
vi.mock("@/lib/catalog/client", () => ({
  createAnonClient: () => createLocalAnonClient(),
}));

// Stripe is mocked at the boundary (06-checkout-orders.md step 2 verify) —
// this test asserts the params the route builds and passes to Stripe, not
// Stripe's own behaviour (covered by build-session.test.ts and the real-API
// check in checkout-stripe-live.test.ts).
const mockSessionsCreate = vi.hoisted(() => vi.fn());
vi.mock("@/lib/stripe", () => ({
  getStripeClient: () => ({ checkout: { sessions: { create: mockSessionsCreate } } }),
}));

// next-intl/server's getTranslations() resolves to a package export gated
// on the `react-server` condition, which Next.js's bundler sets but plain
// Vitest doesn't — under Vitest it resolves to the client build instead,
// which throws ("getTranslations is not supported in Client Components").
// Stood in with a minimal translator reading the real messages/*.json so
// the "checkout" namespace strings this test asserts on are still the real
// ones, not hand-duplicated copies that could drift.
function interpolate(template: string, values?: Record<string, string>): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? "");
}
vi.mock("next-intl/server", () => ({
  getTranslations: async ({ locale, namespace }: { locale: "en" | "fr"; namespace: string }) => {
    const messages = (locale === "fr" ? fr : en) as unknown as Record<string, Record<string, string>>;
    const ns = messages[namespace] ?? {};
    return (key: string, values?: Record<string, string>) => interpolate(ns[key] ?? key, values);
  },
}));

const { POST } = await import("@/app/api/checkout/route");

function request(body: unknown): Request {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/checkout", () => {
  const supabase = createServiceClient();
  const prefix = `test-checkout-${randomUUID().slice(0, 8)}`;

  let designId: string;
  let variantId: string; // qty_on_hand 3
  let manyVariantIds: string[]; // 12 variants on their own design, qty 1 each

  beforeEach(() => {
    mockSessionsCreate.mockReset();
    mockSessionsCreate.mockResolvedValue({ url: "https://checkout.stripe.com/test-session" });
  });

  beforeAll(async () => {
    const { data: design, error: designError } = await supabase
      .from("designs")
      .insert({
        slug: `${prefix}-necklace`,
        category: "necklace",
        name_en: `${prefix} Necklace`,
        price_cents: 1800,
        status: "active",
      })
      .select("id")
      .single();
    if (designError) throw designError;
    designId = design.id;

    const { data: variant, error: variantError } = await supabase
      .from("variants")
      .insert({ design_id: designId, label: "18\"", qty_on_hand: 3 })
      .select("id")
      .single();
    if (variantError) throw variantError;
    variantId = variant.id;

    // A design with many variants, used only to push the metadata JSON
    // past the 500-char cap (too_many_lines).
    const { data: manyDesign, error: manyDesignError } = await supabase
      .from("designs")
      .insert({
        slug: `${prefix}-many`,
        category: "ring",
        name_en: `${prefix} Ring`,
        price_cents: 1000,
        status: "active",
      })
      .select("id")
      .single();
    if (manyDesignError) throw manyDesignError;

    const { data: manyVariants, error: manyVariantsError } = await supabase
      .from("variants")
      .insert(
        Array.from({ length: 12 }, (_, i) => ({
          design_id: manyDesign.id,
          label: String(i + 1),
          qty_on_hand: 1,
        })),
      )
      .select("id");
    if (manyVariantsError) throw manyVariantsError;
    manyVariantIds = manyVariants.map((v) => v.id);
  });

  afterAll(async () => {
    await supabase.from("designs").delete().like("slug", `${prefix}-%`);
  });

  it("creates a pickup session and passes the right params to Stripe", async () => {
    const res = await POST(request({ lines: [{ variantId, qty: 1 }], fulfillment: "pickup", locale: "en" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://checkout.stripe.com/test-session" });

    expect(mockSessionsCreate).toHaveBeenCalledTimes(1);
    const params = mockSessionsCreate.mock.calls[0][0];
    expect(params.mode).toBe("payment");
    expect(params.locale).toBe("en");
    expect(params.line_items).toEqual([
      {
        price_data: {
          currency: "cad",
          unit_amount: 1800,
          product_data: { name: `${prefix} Necklace — 18"`, images: undefined },
        },
        quantity: 1,
      },
    ]);
    expect(params.shipping_address_collection).toBeUndefined();
    expect(params.custom_text.submit.message).toMatch(/pickup/i);
    expect(params.metadata).toEqual({
      fulfillment: "pickup",
      locale: "en",
      lines: JSON.stringify([{ variantId, qty: 1 }]),
    });
  });

  it("dedupes repeated lines for the same variant by summing their quantities", async () => {
    const res = await POST(
      request({
        lines: [
          { variantId, qty: 1 },
          { variantId, qty: 2 },
        ],
        fulfillment: "pickup",
        locale: "en",
      }),
    );
    expect(res.status).toBe(200);

    const params = mockSessionsCreate.mock.calls[0][0];
    expect(params.line_items).toHaveLength(1);
    expect(params.line_items[0].quantity).toBe(3);
    expect(params.metadata.lines).toBe(JSON.stringify([{ variantId, qty: 3 }]));
  });

  // supabase/seed.sql's settings row has shipping_enabled=false — this is
  // the default local state, not something this test toggles (06 step 9).
  it("rejects ship fulfillment when shipping is disabled", async () => {
    const res = await POST(request({ lines: [{ variantId, qty: 1 }], fulfillment: "ship", locale: "en" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "shipping_disabled" });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a line that exceeds qty_on_hand", async () => {
    const res = await POST(request({ lines: [{ variantId, qty: 99 }], fulfillment: "pickup", locale: "en" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unavailable", lines: [{ variantId, available: 3 }] });
  });

  it("rejects a line for a variant that doesn't exist", async () => {
    const badId = randomUUID();
    const res = await POST(request({ lines: [{ variantId: badId, qty: 1 }], fulfillment: "pickup", locale: "en" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "unavailable", lines: [{ variantId: badId, available: 0 }] });
  });

  it("rejects an oversized cart with too_many_lines before calling Stripe", async () => {
    const res = await POST(
      request({
        lines: manyVariantIds.map((id) => ({ variantId: id, qty: 1 })),
        fulfillment: "pickup",
        locale: "en",
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "too_many_lines" });
    expect(mockSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects a malformed request body", async () => {
    const res = await POST(request({ lines: [], fulfillment: "pickup", locale: "en" }));
    expect(res.status).toBe(400);
  });
});
