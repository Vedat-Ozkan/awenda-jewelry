import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAnonClient, createServiceClient } from "../helpers/local-supabase";

const anon = createAnonClient();
const service = createServiceClient();

// Seed's one draft design (supabase/seed.sql) — must stay invisible to anon/authenticated.
const DRAFT_SLUG = "gold-ring-8";
// Seed's one active design used as the "visible" counterpart in the
// design_images test below.
const ACTIVE_SLUG = "silver-necklace-16";

describe("RLS", () => {
  const createdImageIds: string[] = [];

  afterAll(async () => {
    if (createdImageIds.length > 0) {
      await service.from("design_images").delete().in("id", createdImageIds);
    }
  });

  it("anon can select public_designs", async () => {
    const { data, error } = await anon.from("public_designs").select("*");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it("anon can select public_settings", async () => {
    const { data, error } = await anon.from("public_settings").select("*");
    expect(error).toBeNull();
    expect(data?.length ?? 0).toBeGreaterThan(0);
  });

  it.each([
    "designs",
    "variants",
    "orders",
    "order_items",
    "booth_sales",
    "inventory_movements",
    "settings",
    "admin_emails",
  ] as const)("anon selecting %s returns no rows", async (table) => {
    // Deny-by-default RLS with a table-level grant: PostgREST returns 200
    // with an empty array, not an error. Observed locally.
    const { data, error } = await anon.from(table).select("*");
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("anon cannot execute adjust_inventory", async () => {
    const { error } = await anon.rpc("adjust_inventory", {
      p_variant_id: randomUUID(),
      p_delta: -1,
      p_reason: "adjustment",
    });
    expect(error).not.toBeNull();
    expect(error?.message).toContain("permission denied");
  });

  it("anon update/delete on public_settings fails and the row survives", async () => {
    const { data: before } = await service.from("settings").select("market_name").eq("id", 1).single();

    const { error: updateError } = await anon
      .from("public_settings")
      .update({ market_name: "HACKED" })
      .eq("market_name", before?.market_name ?? "");
    expect(updateError).not.toBeNull();
    expect(updateError?.message).toContain("permission denied");

    const { error: deleteError } = await anon
      .from("public_settings")
      .delete()
      .eq("market_name", before?.market_name ?? "");
    expect(deleteError).not.toBeNull();
    expect(deleteError?.message).toContain("permission denied");

    const { data: after } = await service.from("settings").select("market_name").eq("id", 1).single();
    expect(after?.market_name).toBe(before?.market_name);
  });

  it("public_designs has no embedding column", async () => {
    const { error } = await anon.from("public_designs").select("embedding");
    expect(error).not.toBeNull();
  });

  it("draft designs are absent from public_designs", async () => {
    const { data, error } = await anon
      .from("public_designs")
      .select("slug")
      .eq("slug", DRAFT_SLUG);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("design_images selects without error", async () => {
    const { data, error } = await anon.from("design_images").select("*");
    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
  });

  it("design_images: anon sees the active design's image but not the draft's", async () => {
    const { data: draft } = await service
      .from("designs")
      .select("id")
      .eq("slug", DRAFT_SLUG)
      .single();
    const { data: active } = await service
      .from("designs")
      .select("id")
      .eq("slug", ACTIVE_SLUG)
      .single();

    const marker = `rls-test-${randomUUID()}`;
    const { data: inserted, error: insertError } = await service
      .from("design_images")
      .insert([
        {
          design_id: draft!.id,
          main_image_path: `${marker}/draft-main.jpg`,
          thumb_image_path: `${marker}/draft-thumb.jpg`,
        },
        {
          design_id: active!.id,
          main_image_path: `${marker}/active-main.jpg`,
          thumb_image_path: `${marker}/active-thumb.jpg`,
        },
      ])
      .select("id");
    if (insertError) throw insertError;
    createdImageIds.push(...(inserted ?? []).map((row) => row.id));

    const { data, error } = await anon
      .from("design_images")
      .select("design_id")
      .like("main_image_path", `${marker}%`);
    expect(error).toBeNull();
    expect(data).toEqual([{ design_id: active!.id }]);
  });

  it("anon insert into designs fails", async () => {
    const slug = `rls-test-${randomUUID()}`;
    const { error } = await anon
      .from("designs")
      .insert({ slug, category: "ring", name_en: "RLS Test", price_cents: 1000 });
    expect(error).not.toBeNull();

    const { data } = await service.from("designs").select("id").eq("slug", slug);
    expect(data).toEqual([]);
  });

  it("anon insert into variants fails", async () => {
    const label = `rls-test-${randomUUID()}`;
    const { error } = await anon
      .from("variants")
      .insert({ design_id: randomUUID(), label, qty_on_hand: 0 });
    expect(error).not.toBeNull();

    const { data } = await service.from("variants").select("id").eq("label", label);
    expect(data).toEqual([]);
  });

  it("anon insert into orders fails", async () => {
    const stripeSessionId = `rls-test-${randomUUID()}`;
    const { error } = await anon.from("orders").insert({
      stripe_checkout_session_id: stripeSessionId,
      status: "paid",
      fulfillment: "pickup",
      customer_email: "rls-test@example.com",
      subtotal_cents: 1000,
      total_cents: 1000,
    });
    expect(error).not.toBeNull();

    const { data } = await service
      .from("orders")
      .select("id")
      .eq("stripe_checkout_session_id", stripeSessionId);
    expect(data).toEqual([]);
  });

  it("anon insert into booth_sales fails", async () => {
    const note = `rls-test-${randomUUID()}`;
    const { error } = await anon.from("booth_sales").insert({
      category: "ring",
      variant_label: "One size",
      photo_main_path: "booth/test/main.jpg",
      photo_thumb_path: "booth/test/thumb.jpg",
      note,
    });
    expect(error).not.toBeNull();

    const { data } = await service.from("booth_sales").select("id").eq("note", note);
    expect(data).toEqual([]);
  });

  it("anon insert into admin_emails fails", async () => {
    const email = `rls-test-${randomUUID()}@example.com`;
    const { error } = await anon.from("admin_emails").insert({ email });
    expect(error).not.toBeNull();

    const { data } = await service.from("admin_emails").select("email").eq("email", email);
    expect(data).toEqual([]);
  });
});
