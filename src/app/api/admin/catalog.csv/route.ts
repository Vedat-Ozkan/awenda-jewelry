import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// CSV export of the full catalog (Phase 4 step 8): one row per
// design/variant pair. Two queries + a manual join, same pattern as
// src/lib/embeddings/search.ts, rather than a PostgREST embedded-resource
// select.
function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function GET(request: Request) {
  try {
    await requireAdmin(request);
  } catch (response) {
    if (response instanceof Response) return response;
    throw response;
  }

  const supabase = createAdminClient();
  const { data: designs, error: designsError } = await supabase
    .from("designs")
    .select("id, slug, name_en, category, status, price_cents")
    .order("slug");
  if (designsError) throw designsError;

  const { data: variants, error: variantsError } = await supabase
    .from("variants")
    .select("design_id, label, qty_on_hand")
    .order("sort_order");
  if (variantsError) throw variantsError;

  const variantsByDesign = new Map<string, { label: string; qty_on_hand: number }[]>();
  for (const { design_id, ...variant } of variants) {
    const list = variantsByDesign.get(design_id) ?? [];
    list.push(variant);
    variantsByDesign.set(design_id, list);
  }

  const rows = [["slug", "name_en", "category", "status", "price_cents", "variant_label", "qty_on_hand"]];
  for (const d of designs) {
    const designVariants = variantsByDesign.get(d.id) ?? [];
    for (const v of designVariants) {
      rows.push([d.slug, d.name_en, d.category, d.status, String(d.price_cents), v.label, String(v.qty_on_hand)]);
    }
  }

  const csv = rows.map((row) => row.map(csvField).join(",")).join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": "attachment; filename=catalog.csv",
    },
  });
}
