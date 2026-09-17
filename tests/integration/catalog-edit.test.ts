import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "../helpers/local-supabase";

// Phase 4 step 5. Same mocking pattern as tests/integration/catalog-actions.test.ts.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdminFromCookies: async () => ({ user: { email: "admin@example.com" }, email: "admin@example.com" }),
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: vi.fn() }));

const { updateDesign, addVariant, removeVariant, adjustVariantQty } = await import(
  "@/app/(admin)/admin/(shell)/catalog/[id]/actions"
);

describe("catalog edit-design actions", () => {
  const supabase = createServiceClient();
  const designIds: string[] = [];

  afterAll(async () => {
    for (const designId of designIds) {
      const { data: variants } = await supabase.from("variants").select("id").eq("design_id", designId);
      const variantIds = (variants ?? []).map((v) => v.id);
      if (variantIds.length > 0) {
        await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
      }
      await supabase.from("designs").delete().eq("id", designId);
    }
  });

  async function createDesign(overrides: { slug?: string; nameEn?: string } = {}) {
    const suffix = randomUUID().slice(0, 8);
    const { data, error } = await supabase
      .from("designs")
      .insert({
        slug: overrides.slug ?? `test-edit-${suffix}`,
        category: "ring",
        name_en: overrides.nameEn ?? `Test Edit ${suffix}`,
        price_cents: 1000,
        status: "active",
      })
      .select("id, slug")
      .single();
    if (error) throw error;
    designIds.push(data.id);
    return data;
  }

  async function createVariant(designId: string, label: string, qty: number) {
    const { data, error } = await supabase
      .from("variants")
      .insert({ design_id: designId, label, qty_on_hand: qty })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  const baseFields = {
    category: "ring" as const,
    nameEn: "Updated Name",
    priceCents: 2500,
    status: "active" as const,
  };

  it("updates fields and records the old slug in previous_slugs on a slug change", async () => {
    const design = await createDesign();
    const newSlug = `new-slug-${randomUUID().slice(0, 8)}`;

    const result = await updateDesign(design.id, { ...baseFields, slug: newSlug });
    expect(result.slug).toBe(newSlug);

    const { data: updated } = await supabase
      .from("designs")
      .select("slug, previous_slugs, name_en, price_cents")
      .eq("id", design.id)
      .single();
    expect(updated?.slug).toBe(newSlug);
    expect(updated?.previous_slugs).toContain(design.slug);
    expect(updated?.name_en).toBe("Updated Name");
    expect(updated?.price_cents).toBe(2500);
  });

  it("rejects a slug already used by a different design", async () => {
    const taken = await createDesign();
    const design = await createDesign();

    await expect(updateDesign(design.id, { ...baseFields, slug: taken.slug })).rejects.toThrow(/already in use/i);
  });

  it("does not touch previous_slugs when the slug is unchanged", async () => {
    const design = await createDesign();

    await updateDesign(design.id, { ...baseFields, slug: design.slug });

    const { data: updated } = await supabase.from("designs").select("previous_slugs").eq("id", design.id).single();
    expect(updated?.previous_slugs).toEqual([]);
  });

  it("restock writes a restock movement and increases qty_on_hand", async () => {
    const design = await createDesign();
    const variantId = await createVariant(design.id, "restock-variant", 0);

    await adjustVariantQty(design.id, variantId, 2, "restock", "test restock");

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(2);

    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("delta, reason, note, ref_id")
      .eq("variant_id", variantId);
    expect(movements).toHaveLength(1);
    expect(movements?.[0]).toMatchObject({ delta: 2, reason: "restock", note: "test restock", ref_id: design.id });
  });

  it("a negative adjustment below zero fails with insufficient_stock and writes no movement", async () => {
    const design = await createDesign();
    const variantId = await createVariant(design.id, "adjustment-variant", 1);

    await expect(adjustVariantQty(design.id, variantId, -5, "adjustment")).rejects.toThrow(/insufficient_stock/);

    const { data: variant } = await supabase.from("variants").select("qty_on_hand").eq("id", variantId).single();
    expect(variant?.qty_on_hand).toBe(1);

    const { count } = await supabase
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("variant_id", variantId);
    expect(count).toBe(0);
  });

  it("rejects removing a variant with qty > 0", async () => {
    const design = await createDesign();
    const variantId = await createVariant(design.id, "has-stock", 3);

    await expect(removeVariant(design.id, variantId)).rejects.toThrow(/stock/i);

    const { data: variant } = await supabase.from("variants").select("id").eq("id", variantId).maybeSingle();
    expect(variant).not.toBeNull();
  });

  it("removes a variant at qty 0 with no order references", async () => {
    const design = await createDesign();
    const variantId = await createVariant(design.id, "removable", 0);

    await removeVariant(design.id, variantId);

    const { data: variant } = await supabase.from("variants").select("id").eq("id", variantId).maybeSingle();
    expect(variant).toBeNull();
  });

  it("adds a variant at qty 0", async () => {
    const design = await createDesign();

    await addVariant(design.id, "new-label");

    const { data: variant } = await supabase
      .from("variants")
      .select("qty_on_hand")
      .eq("design_id", design.id)
      .eq("label", "new-label")
      .single();
    expect(variant?.qty_on_hand).toBe(0);
  });
});
