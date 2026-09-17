import type { createServiceClient } from "../../tests/helpers/local-supabase";

// Test-created designs are always either a still-untitled draft (slug
// "untitled[-suffix]" from createDraftDesign(), left behind if a test fails
// before renaming it) or a published design named "E2E ..." (the new-design
// spec). Removes both unconditionally, regardless of whether the test that
// created them passed, failed, or crashed mid-run — called from
// beforeAll/afterAll in both admin-catalog.spec.ts and
// admin-new-design.spec.ts so a previous broken run can never leak into a
// later one (e.g. inflating the catalog list's row count).
export async function cleanupLeakedTestDesigns(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<void> {
  const { data: designs, error } = await supabase
    .from("designs")
    .select("id")
    .or("slug.like.untitled%,name_en.like.E2E%");
  if (error) throw error;

  for (const { id } of designs ?? []) {
    const { data: variants } = await supabase.from("variants").select("id").eq("design_id", id);
    const variantIds = (variants ?? []).map((v) => v.id);
    if (variantIds.length > 0) {
      await supabase.from("inventory_movements").delete().in("variant_id", variantIds);
    }

    const { data: files } = await supabase.storage.from("photos").list(`designs/${id}`);
    if (files && files.length > 0) {
      await supabase.storage.from("photos").remove(files.map((f) => `designs/${id}/${f.name}`));
    }

    await supabase.from("designs").delete().eq("id", id);
  }
}
