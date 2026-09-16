import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServiceClient } from "../helpers/local-supabase";

// Exercises adjust_inventory() and next_market_date() (0003_functions.sql)
// against local Supabase. Uses its own design/variants rather than relying
// on seed row ordering (supabase/seed.sql), so it's independent of the seed.
describe("inventory", () => {
  const supabase = createServiceClient();
  const slug = `test-inv-${randomUUID().slice(0, 8)}`;
  let designId: string;

  beforeAll(async () => {
    const { data, error } = await supabase
      .from("designs")
      .insert({ slug, category: "ring", name_en: "Test Inventory Design", price_cents: 1000 })
      .select("id")
      .single();
    if (error) throw error;
    designId = data.id;
  });

  afterAll(async () => {
    // inventory_movements.variant_id has no ON DELETE cascade (0002_core.sql),
    // so movements for this design's variants must be deleted before the
    // design delete cascades into variants.
    const { data: variants } = await supabase
      .from("variants")
      .select("id")
      .eq("design_id", designId);
    const variantIds = (variants ?? []).map((v) => v.id);
    if (variantIds.length > 0) {
      await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
    }
    await supabase.from("designs").delete().eq("id", designId);
  });

  async function createVariant(label: string, qty: number) {
    const { data, error } = await supabase
      .from("variants")
      .insert({ design_id: designId, label, qty_on_hand: qty })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  it("decrements qty_on_hand and writes a movement", async () => {
    const variantId = await createVariant("decrement", 5);
    const refId = randomUUID();

    const { data: newQty, error } = await supabase.rpc("adjust_inventory", {
      p_variant_id: variantId,
      p_delta: -2,
      p_reason: "adjustment",
      p_ref_id: refId,
      p_note: "test decrement",
    });
    expect(error).toBeNull();
    expect(newQty).toBe(3);

    const { data: variant } = await supabase
      .from("variants")
      .select("qty_on_hand")
      .eq("id", variantId)
      .single();
    expect(variant?.qty_on_hand).toBe(3);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, ref_id")
      .eq("variant_id", variantId);
    expect(movements).toHaveLength(1);
    expect(movements?.[0]).toMatchObject({ delta: -2, reason: "adjustment", ref_id: refId });
  });

  it("rejects a decrement below zero and writes no movement", async () => {
    const variantId = await createVariant("below-zero", 1);

    const before = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId);

    const { error } = await supabase.rpc("adjust_inventory", {
      p_variant_id: variantId,
      p_delta: -5,
      p_reason: "adjustment",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("insufficient_stock");

    const after = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId);
    expect(after.count).toBe(before.count);

    const { data: variant } = await supabase
      .from("variants")
      .select("qty_on_hand")
      .eq("id", variantId)
      .single();
    expect(variant?.qty_on_hand).toBe(1);
  });

  it("allows exactly one of two concurrent decrements of the last unit", async () => {
    const variantId = await createVariant("concurrent-last-unit", 1);

    const results = await Promise.allSettled([
      supabase
        .rpc("adjust_inventory", { p_variant_id: variantId, p_delta: -1, p_reason: "booth_sale" })
        .throwOnError(),
      supabase
        .rpc("adjust_inventory", { p_variant_id: variantId, p_delta: -1, p_reason: "booth_sale" })
        .throwOnError(),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain("insufficient_stock");

    const { data: variant } = await supabase
      .from("variants")
      .select("qty_on_hand")
      .eq("id", variantId)
      .single();
    expect(variant?.qty_on_hand).toBe(0);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("id")
      .eq("variant_id", variantId);
    expect(movements).toHaveLength(1);
  });

  it("next_market_date() returns the seeded weekday and honours market_closed_until", async () => {
    const { data: original } = await supabase
      .from("settings")
      .select("market_closed_until")
      .eq("id", 1)
      .single();

    try {
      await supabase.from("settings").update({ market_closed_until: null }).eq("id", 1);

      const { data: firstDate, error } = await supabase.rpc("next_market_date");
      expect(error).toBeNull();
      expect(firstDate).toBeTruthy();

      const first = new Date(`${firstDate}T00:00:00Z`);
      expect(first.getUTCDay()).toBe(6); // seeded settings.market_weekday (supabase/seed.sql)

      const today = new Date();
      today.setUTCHours(0, 0, 0, 0);
      expect(first.getTime()).toBeGreaterThanOrEqual(today.getTime());

      await supabase.from("settings").update({ market_closed_until: firstDate }).eq("id", 1);

      const { data: secondDate, error: secondError } = await supabase.rpc("next_market_date");
      expect(secondError).toBeNull();
      const second = new Date(`${secondDate}T00:00:00Z`);
      expect(second.getTime()).toBeGreaterThan(first.getTime());
      expect(second.getUTCDay()).toBe(6);
    } finally {
      await supabase
        .from("settings")
        .update({ market_closed_until: original?.market_closed_until ?? null })
        .eq("id", 1);
    }
  });

  it("next_market_date() returns null when market_weekday isn't configured", async () => {
    const { data: original } = await supabase
      .from("settings")
      .select("market_weekday")
      .eq("id", 1)
      .single();

    try {
      await supabase.from("settings").update({ market_weekday: null }).eq("id", 1);

      const { data, error } = await supabase.rpc("next_market_date");
      expect(error).toBeNull();
      expect(data).toBeNull();
    } finally {
      await supabase
        .from("settings")
        .update({ market_weekday: original?.market_weekday ?? null })
        .eq("id", 1);
    }
  });
});
