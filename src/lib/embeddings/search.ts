import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Design = Pick<
  Database["public"]["Tables"]["designs"]["Row"],
  "id" | "slug" | "name_en" | "category" | "thumb_image_path" | "status"
>;
type Variant = Pick<Database["public"]["Tables"]["variants"]["Row"], "id" | "label" | "qty_on_hand">;

export interface Candidate {
  design: Design;
  variants: Variant[];
  distance: number;
  rank: number;
  crossCategory: boolean;
}

// Wraps match_designs() (0003_functions.sql, service_role-only — see
// DECISIONS.md "Phase 2 plan drift") for the reconciliation flow: given a
// logged booth sale, returns its top-k catalog candidates. Prefers designs in
// the booth sale's own category; if that yields fewer than k, fills the rest
// from any category and flags those `crossCategory: true`. Must run
// server-side only (uses the service-role client).
export async function findCandidates(boothSaleId: string, k = 3): Promise<Candidate[]> {
  const supabase = createAdminClient();

  const { data: boothSale, error: boothSaleError } = await supabase
    .from("booth_sales")
    .select("embedding, category")
    .eq("id", boothSaleId)
    .single();
  if (boothSaleError) throw boothSaleError;
  if (!boothSale.embedding) {
    throw new Error(`Booth sale ${boothSaleId} has no embedding yet`);
  }

  // pgvector columns come back from PostgREST as their string literal form
  // (e.g. "[0.1,0.2,...]") and match_designs()'s query_embedding accepts
  // that same string form directly — no parsing needed (verified against
  // local Supabase).
  const { data: sameCategory, error: sameCategoryError } = await supabase.rpc("match_designs", {
    query_embedding: boothSale.embedding,
    match_count: k,
    p_category: boothSale.category,
  });
  if (sameCategoryError) throw sameCategoryError;

  const matches = (sameCategory ?? []).map((m) => ({ ...m, crossCategory: false }));

  if (matches.length < k) {
    // Omitting p_category (rather than passing null) falls back to its SQL
    // default of null, i.e. no category filter.
    const { data: anyCategory, error: anyCategoryError } = await supabase.rpc("match_designs", {
      query_embedding: boothSale.embedding,
      match_count: k,
    });
    if (anyCategoryError) throw anyCategoryError;

    const seen = new Set(matches.map((m) => m.design_id));
    for (const m of anyCategory ?? []) {
      if (matches.length >= k) break;
      if (seen.has(m.design_id)) continue;
      matches.push({ ...m, crossCategory: true });
      seen.add(m.design_id);
    }
  }

  if (matches.length === 0) return [];

  const designIds = matches.map((m) => m.design_id);
  const { data: designs, error: designsError } = await supabase
    .from("designs")
    .select("id, slug, name_en, category, thumb_image_path, status")
    .in("id", designIds);
  if (designsError) throw designsError;

  const { data: variants, error: variantsError } = await supabase
    .from("variants")
    .select("id, label, qty_on_hand, design_id")
    .in("design_id", designIds);
  if (variantsError) throw variantsError;

  const designById = new Map(designs.map((d) => [d.id, d]));
  const variantsByDesign = new Map<string, Variant[]>();
  for (const { design_id, ...variant } of variants) {
    const list = variantsByDesign.get(design_id) ?? [];
    list.push(variant);
    variantsByDesign.set(design_id, list);
  }

  return matches.map((m, i) => {
    const design = designById.get(m.design_id);
    if (!design) throw new Error(`match_designs returned unknown design ${m.design_id}`);
    return {
      design,
      variants: variantsByDesign.get(m.design_id) ?? [],
      distance: m.distance,
      rank: i + 1,
      crossCategory: m.crossCategory,
    };
  });
}
