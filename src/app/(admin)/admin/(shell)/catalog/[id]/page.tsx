import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EditDesignClient } from "./edit-design-client";

// Edit design (Phase 4 step 5): server component, RLS-enforced cookie
// client (designs_admin_all policy — is_admin() sees drafts/archived too).
// Two extra queries (design_images, movement ledger) rather than a
// PostgREST embedded-resource select, same two-query + manual join pattern
// as src/app/admin/(shell)/catalog/page.tsx and src/lib/embeddings/search.ts.
export default async function EditDesignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: design, error: designError } = await supabase
    .from("designs")
    .select(
      "id, slug, previous_slugs, category, name_en, name_fr, description_en, description_fr, material_en, material_fr, dimensions, price_cents, status, main_image_path, thumb_image_path",
    )
    .eq("id", id)
    .maybeSingle();
  if (designError) throw designError;
  if (!design) notFound();

  const { data: variants, error: variantsError } = await supabase
    .from("variants")
    .select("id, label, qty_on_hand, sort_order")
    .eq("design_id", id)
    .order("sort_order");
  if (variantsError) throw variantsError;

  const { data: images, error: imagesError } = await supabase
    .from("design_images")
    .select("id, main_image_path, thumb_image_path, sort_order")
    .eq("design_id", id)
    .order("sort_order");
  if (imagesError) throw imagesError;

  const variantIds = variants.map((v) => v.id);
  const { data: movements, error: movementsError } =
    variantIds.length > 0
      ? await supabase
          .from("inventory_movements")
          .select("id, variant_id, delta, reason, note, created_at")
          .in("variant_id", variantIds)
          .order("created_at", { ascending: false })
          .limit(20)
      : { data: [], error: null };
  if (movementsError) throw movementsError;

  const labelByVariantId = new Map(variants.map((v) => [v.id, v.label]));
  const ledger = (movements ?? []).map((m) => ({ ...m, variant_label: labelByVariantId.get(m.variant_id) ?? "?" }));

  return <EditDesignClient design={design} variants={variants} images={images} ledger={ledger} />;
}
