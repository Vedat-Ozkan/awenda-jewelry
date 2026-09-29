import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { summarySchema } from "@/lib/analytics/summary";
import { createAnonClient, createServiceClient } from "../helpers/local-supabase";

// Phase 7 step 5: analytics_summary() (0013_analytics_functions.sql) against
// seeded events and orders. A fixed 2020 range (Mon 2020-03-02 .. Sun
// 2020-03-15) keeps the assertions independent of any other data in the DB.
// Timestamps sit at midday UTC so they land on the same calendar day in any
// North American market timezone.
const service = createServiceClient();
const anon = createAnonClient();
const FROM = "2020-03-02";
const TO = "2020-03-15";

const tag = randomUUID().slice(0, 8);
const [s1, s2, s3, s4] = [1, 2, 3, 4].map((n) => `${tag}-session-${n}`);
const designIds: string[] = [];
let inStockId: string;
let soldOutId: string;

async function createDesign(name: string, qty: number) {
  const slug = `${tag}-${name.toLowerCase().replace(/\s+/g, "-")}`;
  const { data: design, error } = await service
    .from("designs")
    .insert({ slug, category: "ring", name_en: `${tag} ${name}`, price_cents: 2500, status: "active" })
    .select("id")
    .single();
  if (error) throw error;
  designIds.push(design.id);
  const { error: variantError } = await service
    .from("variants")
    .insert({ design_id: design.id, label: "One size", qty_on_hand: qty });
  if (variantError) throw variantError;
  return design.id;
}

type EventRow = {
  event: "page_view" | "design_view" | "add_to_cart" | "begin_checkout";
  session_id: string;
  at: string;
  locale?: string;
  device?: string;
  referrer_host?: string;
  design_id?: string;
};

async function seedEvents(rows: EventRow[]) {
  const { error } = await service.from("analytics_events").insert(
    rows.map(({ at, locale, device, ...rest }) => ({
      ...rest,
      occurred_at: `${at}T12:00:00Z`,
      locale: locale ?? "en",
      device: device ?? "desktop",
    })),
  );
  if (error) throw error;
}

async function seedOrder(day: string, fulfillment: "ship" | "pickup", status: "paid" | "refunded", totalCents: number) {
  const { error } = await service.from("orders").insert({
    stripe_checkout_session_id: `cs_test_${tag}_${randomUUID()}`,
    status,
    fulfillment,
    customer_email: `${tag}@example.com`,
    subtotal_cents: totalCents,
    total_cents: totalCents,
    created_at: `${day}T12:00:00Z`,
  });
  if (error) throw error;
}

describe("analytics_summary()", () => {
  beforeAll(async () => {
    inStockId = await createDesign("In Stock Ring", 3);
    soldOutId = await createDesign("Sold Out Ring", 0);

    await seedEvents([
      { event: "page_view", session_id: s1, at: "2020-03-03", device: "mobile", referrer_host: "google.com" },
      { event: "design_view", session_id: s1, at: "2020-03-03", device: "mobile", design_id: inStockId },
      { event: "design_view", session_id: s1, at: "2020-03-03", device: "mobile", design_id: inStockId },
      { event: "design_view", session_id: s1, at: "2020-03-03", device: "mobile", design_id: soldOutId },
      { event: "add_to_cart", session_id: s1, at: "2020-03-03", device: "mobile", design_id: inStockId },
      { event: "page_view", session_id: s2, at: "2020-03-04", locale: "fr" },
      { event: "design_view", session_id: s2, at: "2020-03-04", locale: "fr", design_id: soldOutId },
      { event: "begin_checkout", session_id: s2, at: "2020-03-04", locale: "fr" },
      { event: "page_view", session_id: s3, at: "2020-03-10" },
      // Outside the range: must not be counted.
      { event: "page_view", session_id: s4, at: "2020-03-01" },
      { event: "design_view", session_id: s4, at: "2020-03-20", design_id: soldOutId },
    ]);

    await seedOrder("2020-03-04", "ship", "paid", 2500);
    await seedOrder("2020-03-10", "pickup", "paid", 1500);
    await seedOrder("2020-03-05", "ship", "refunded", 9999); // excluded
    await seedOrder("2020-03-20", "ship", "paid", 7777); // out of range
  });

  afterAll(async () => {
    await service.from("orders").delete().like("stripe_checkout_session_id", `cs_test_${tag}_%`);
    await service.from("analytics_events").delete().like("session_id", `${tag}-%`);
    if (designIds.length > 0) await service.from("designs").delete().in("id", designIds);
  });

  async function summary() {
    const { data, error } = await service.rpc("analytics_summary", { p_from: FROM, p_to: TO });
    expect(error).toBeNull();
    return summarySchema.parse(data);
  }

  it("computes the funnel tiles and order totals for the range", async () => {
    const s = await summary();
    expect(s).toMatchObject({
      sessions: 3,
      design_views: 4,
      add_to_carts: 1,
      begin_checkouts: 1,
      orders: 2,
      revenue_cents: 4000,
      ship_orders: 1,
      pickup_orders: 1,
    });
  });

  it("returns one row per day and per week, zero-filled", async () => {
    const s = await summary();
    expect(s.by_day).toHaveLength(14);
    expect(s.by_day.find((d) => d.day === "2020-03-03")).toMatchObject({ sessions: 1, orders: 0 });
    expect(s.by_day.find((d) => d.day === "2020-03-04")).toMatchObject({ sessions: 1, orders: 1 });
    expect(s.by_day.find((d) => d.day === "2020-03-07")).toMatchObject({ sessions: 0, orders: 0 });
    expect(s.revenue_by_week).toEqual([
      { week: "2020-03-02", revenue_cents: 2500 },
      { week: "2020-03-09", revenue_cents: 1500 },
    ]);
  });

  it("ranks designs, and the sold-out list only holds sold-out designs", async () => {
    const s = await summary();
    // Equal views tie-break by name: "In Stock Ring" sorts before "Sold Out Ring".
    expect(s.top_designs.map((d) => [d.design_id, d.views])).toEqual([
      [inStockId, 2],
      [soldOutId, 2],
    ]);
    expect(s.sold_out_designs.map((d) => [d.design_id, d.views])).toEqual([[soldOutId, 2]]);
  });

  it("splits referrers, locales and devices by distinct session", async () => {
    const s = await summary();
    expect(s.referrers).toEqual([{ host: "google.com", sessions: 1 }]);
    expect(s.locales).toEqual([
      { locale: "en", sessions: 2 },
      { locale: "fr", sessions: 1 },
    ]);
    expect(s.devices).toEqual([
      { device: "desktop", sessions: 2 },
      { device: "mobile", sessions: 1 },
    ]);
  });

  it("is not callable by anon", async () => {
    const { error } = await anon.rpc("analytics_summary", { p_from: FROM, p_to: TO });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("permission denied");
  });
});
