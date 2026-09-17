import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "../helpers/local-supabase";

// Phase 4 step 4. Same mocking pattern as tests/integration/search.test.ts
// and photos-route.test.ts: `@/lib/supabase/admin` imports `server-only`,
// which throws outside a Next.js server bundle, so it's swapped for the
// real local-Supabase service-role client. `@/lib/auth` is mocked too since
// requireAdminFromCookies() reads cookies via next/headers, unavailable
// outside a request context — these actions only care that it doesn't throw.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));
vi.mock("@/lib/auth", () => ({
  requireAdminFromCookies: async () => ({ user: { email: "admin@example.com" }, email: "admin@example.com" }),
}));
// revalidatePath() requires a Next.js request/render context that doesn't
// exist under Vitest ("Invariant: static generation store missing").
vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: vi.fn() }));

const { createDraftDesign, saveDesignDetails } = await import("@/app/(admin)/admin/(shell)/catalog/new/actions");

describe("catalog new-design actions", () => {
  const supabase = createServiceClient();
  const createdDesignIds: string[] = [];

  afterAll(async () => {
    for (const designId of createdDesignIds) {
      const { data: variants } = await supabase.from("variants").select("id").eq("design_id", designId);
      const variantIds = (variants ?? []).map((v) => v.id);
      if (variantIds.length > 0) {
        await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
      }
      await supabase.from("designs").delete().eq("id", designId);
    }
  });

  it("creates a draft with a placeholder name, price, and slug", async () => {
    const { id, slug } = await createDraftDesign();
    createdDesignIds.push(id);

    expect(slug.startsWith("untitled")).toBe(true);

    const { data: design } = await supabase
      .from("designs")
      .select("name_en, price_cents, status, category")
      .eq("id", id)
      .single();
    expect(design).toMatchObject({ name_en: "Untitled", price_cents: 100, status: "draft", category: "ring" });
  });

  it("saves details with two variants, derives the slug from the name, and publishes", async () => {
    const { id } = await createDraftDesign();
    createdDesignIds.push(id);
    const uniqueName = `Test Necklace ${randomUUID().slice(0, 8)}`;

    const { slug } = await saveDesignDetails(
      id,
      {
        category: "necklace",
        nameEn: uniqueName,
        priceCents: 4500,
        variants: [
          { label: "16\"", qty: 2 },
          { label: "18\"", qty: 1 },
        ],
      },
      { publish: true },
    );

    expect(slug).not.toMatch(/^untitled/);

    const { data: design } = await supabase
      .from("designs")
      .select("name_en, price_cents, status, category, slug")
      .eq("id", id)
      .single();
    expect(design).toMatchObject({
      name_en: uniqueName,
      price_cents: 4500,
      status: "active",
      category: "necklace",
      slug,
    });

    const { data: variants } = await supabase
      .from("variants")
      .select("id, label, qty_on_hand")
      .eq("design_id", id)
      .order("label");
    expect(variants).toHaveLength(2);
    expect(variants?.find((v) => v.label === "16\"")).toMatchObject({ qty_on_hand: 2 });
    expect(variants?.find((v) => v.label === "18\"")).toMatchObject({ qty_on_hand: 1 });

    const variantIds = (variants ?? []).map((v) => v.id);
    const { data: movements } = await supabase
      .from("inventory_movements")
      .select("variant_id, delta, reason, ref_id")
      .in("variant_id", variantIds);
    expect(movements).toHaveLength(2);
    for (const movement of movements ?? []) {
      expect(movement.reason).toBe("catalog");
      expect(movement.ref_id).toBe(id);
    }
  });

  it("rejects publishing while the name is still Untitled", async () => {
    const { id } = await createDraftDesign();
    createdDesignIds.push(id);

    await expect(
      saveDesignDetails(
        id,
        {
          category: "ring",
          nameEn: "Untitled",
          priceCents: 1800,
          variants: [{ label: "7", qty: 1 }],
        },
        { publish: true },
      ),
    ).rejects.toThrow(/name/i);
  });

  it("rejects publishing without a real price", async () => {
    const { id } = await createDraftDesign();
    createdDesignIds.push(id);

    await expect(
      saveDesignDetails(
        id,
        {
          category: "ring",
          nameEn: "Test Ring",
          priceCents: 100,
          variants: [{ label: "7", qty: 1 }],
        },
        { publish: true },
      ),
    ).rejects.toThrow(/price/i);
  });

  it("rejects publishing without at least one variant", async () => {
    const { id } = await createDraftDesign();
    createdDesignIds.push(id);

    await expect(
      saveDesignDetails(
        id,
        {
          category: "ring",
          nameEn: "Test Ring",
          priceCents: 1800,
          variants: [],
        },
        { publish: true },
      ),
    ).rejects.toThrow(/variant/i);
  });

  it("allows saving as draft without a name, price, or variant", async () => {
    const { id } = await createDraftDesign();
    createdDesignIds.push(id);

    await saveDesignDetails(id, { category: "ring", nameEn: "Untitled", priceCents: 100, variants: [] }, { publish: false });

    const { data: design } = await supabase.from("designs").select("status").eq("id", id).single();
    expect(design?.status).toBe("draft");
  });
});
