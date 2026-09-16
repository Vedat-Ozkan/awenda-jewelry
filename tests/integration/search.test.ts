import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createServiceClient } from "../helpers/local-supabase";
import { fakeProvider } from "@/lib/embeddings/fake";

// `src/lib/supabase/admin.ts` imports the `server-only` package, which
// throws unconditionally outside a Next.js server bundle (see the comment in
// scripts/seed-admins.ts) — including under Vitest. findCandidates() (the
// module under test) uses createAdminClient() internally, so it's swapped
// here for the same local-Supabase service-role client the test's own setup
// uses, keeping this a real integration test against local Supabase rather
// than a stub.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createServiceClient(),
}));

const { findCandidates } = await import("@/lib/embeddings/search");

// Exercises findCandidates() (src/lib/embeddings/search.ts) against local
// Supabase with the fake embedding provider — no network, no Voyage key.
// Uses its own designs/booth_sales (prefix `test-search-`) rather than the
// seed catalog: seed designs are inserted with no `embedding` (supabase/seed.sql),
// so they're invisible to match_designs() (`where embedding is not null`) and
// can't interfere. Asserted directly in beforeAll below.
describe("findCandidates", () => {
  const supabase = createServiceClient();
  const prefix = `test-search-${randomUUID().slice(0, 8)}`;

  async function embed(key: string) {
    const bytes = Buffer.from(`AWENDA_FAKE_KEY=${key}`, "latin1");
    const vector = await fakeProvider.embedImage(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      "document",
    );
    return `[${vector.join(",")}]`;
  }

  async function createDesign(slug: string, category: "ring" | "necklace", key: string) {
    const { data, error } = await supabase
      .from("designs")
      .insert({
        slug,
        category,
        name_en: slug,
        price_cents: 1000,
        status: "active",
        embedding: await embed(key),
      })
      .select("id")
      .single();
    if (error) throw error;
    await supabase.from("variants").insert({ design_id: data.id, label: "One size", qty_on_hand: 3 });
    return data.id;
  }

  async function createBoothSale(category: "ring" | "necklace", key: string) {
    const { data, error } = await supabase
      .from("booth_sales")
      .insert({
        category,
        variant_label: "One size",
        photo_main_path: `${prefix}/booth.jpg`,
        photo_thumb_path: `${prefix}/booth-thumb.jpg`,
        embedding: await embed(key),
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id;
  }

  let designAId: string;
  let designBId: string;
  let designCId: string;
  const boothSaleIds: string[] = [];

  beforeAll(async () => {
    // A and B share category "ring"; C is alone in "necklace".
    designAId = await createDesign(`${prefix}-a`, "ring", "A");
    designBId = await createDesign(`${prefix}-b`, "ring", "B");
    designCId = await createDesign(`${prefix}-c`, "necklace", "C");

    // Confirms the "seed designs have null embeddings" assumption this test
    // relies on for isolation: only this test's 3 designs (matched by slug
    // prefix, not a DB-wide count — photos-route.test.ts embeds designs of
    // its own and can run concurrently in another worker) should have a
    // non-null embedding.
    const { count, error } = await supabase
      .from("designs")
      .select("id", { count: "exact", head: true })
      .like("slug", `${prefix}%`)
      .not("embedding", "is", null);
    if (error) throw error;
    expect(count).toBe(3);
  });

  afterAll(async () => {
    if (boothSaleIds.length > 0) {
      await supabase.from("booth_sales").delete().in("id", boothSaleIds);
    }
    // variants cascade on design delete (0002_core.sql: design_id ... on delete cascade)
    await supabase.from("designs").delete().in("id", [designAId, designBId, designCId]);
  });

  it("prefers same-category matches and ranks an exact embedding match first", async () => {
    const boothSaleId = await createBoothSale("ring", "A");
    boothSaleIds.push(boothSaleId);

    const candidates = await findCandidates(boothSaleId, 3);

    expect(candidates[0].design.id).toBe(designAId);
    expect(candidates[0].rank).toBe(1);
    expect(candidates[0].distance).toBeLessThan(1e-6);
    expect(candidates[0].crossCategory).toBe(false);
    expect(candidates[0].variants).toEqual([
      expect.objectContaining({ label: "One size", qty_on_hand: 3 }),
    ]);
  });

  it("falls back to other categories when the booth sale's category has too few embedded designs", async () => {
    // "necklace" has only design C embedded; querying with A's embedding
    // forces the < k fallback to fill in cross-category candidates.
    const boothSaleId = await createBoothSale("necklace", "A");
    boothSaleIds.push(boothSaleId);

    const candidates = await findCandidates(boothSaleId, 3);

    const own = candidates.find((c) => c.design.id === designCId);
    expect(own?.crossCategory).toBe(false);

    const crossCategoryMatches = candidates.filter((c) => c.crossCategory);
    expect(crossCategoryMatches.length).toBeGreaterThan(0);
    expect(crossCategoryMatches.some((c) => c.design.id === designAId)).toBe(true);

    // ranks are 1-based and follow distance order
    expect(candidates.map((c) => c.rank)).toEqual(candidates.map((_, i) => i + 1));
  });
});
