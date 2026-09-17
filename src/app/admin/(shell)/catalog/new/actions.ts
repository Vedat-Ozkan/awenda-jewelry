"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminFromCookies } from "@/lib/auth";
import { slugify, uniqueSlug } from "@/lib/catalog/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["category"];

// Placeholder price for a freshly created draft: designs.price_cents has a
// `> 0` check constraint, so a draft can't be inserted with 0. Doubles as
// the "still a placeholder" sentinel that blocks Publish below, the same
// way name_en "Untitled" does.
const DRAFT_PRICE_CENTS = 100;

// Screen 1 (Photos): one draft design per selected file. Category defaults
// to "ring" — the real category is picked on screen 2.
export async function createDraftDesign(): Promise<{ id: string; slug: string }> {
  await requireAdminFromCookies();
  const supabase = createAdminClient();

  const slug = await uniqueSlug("untitled");
  const { data, error } = await supabase
    .from("designs")
    .insert({ slug, category: "ring", name_en: "Untitled", price_cents: DRAFT_PRICE_CENTS, status: "draft" })
    .select("id, slug")
    .single();
  if (error) throw error;

  return data;
}

const CATEGORIES: [Category, ...Category[]] = [
  "necklace",
  "bracelet",
  "anklet",
  "ring",
  "earring",
  "bangle",
  "chain",
  "pendant",
];

const detailsSchema = z.object({
  category: z.enum(CATEGORIES),
  nameEn: z.string().min(1),
  nameFr: z.string().optional(),
  priceCents: z.number().int().positive(),
  descriptionEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  materialEn: z.string().optional(),
  materialFr: z.string().optional(),
  dimensions: z.string().optional(),
  variants: z.array(z.object({ label: z.string().min(1), qty: z.number().int().min(0) })),
});

type DesignDetails = z.input<typeof detailsSchema>;

// Screen 2 (Details): updates the draft's fields, creates its variants
// (qty_on_hand = 0 on insert, then adjust_inventory('catalog') for any with
// qty > 0 so the ledger starts at the initial count — mirrors
// supabase/seed.sql), and sets status. Slug is regenerated from the name
// only if it's still the "untitled[-suffix]" slug from createDraftDesign.
export async function saveDesignDetails(
  id: string,
  data: DesignDetails,
  options: { publish: boolean },
): Promise<{ slug: string }> {
  await requireAdminFromCookies();
  const parsed = detailsSchema.parse(data);

  if (options.publish) {
    if (parsed.nameEn === "Untitled") throw new Error("Enter a name before publishing");
    if (parsed.priceCents <= 0 || parsed.priceCents === DRAFT_PRICE_CENTS) {
      throw new Error("Enter a price before publishing");
    }
    if (parsed.variants.length === 0) throw new Error("Add at least one variant before publishing");
  }

  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("designs")
    .select("slug")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const slug = existing.slug.startsWith("untitled") ? await uniqueSlug(slugify(parsed.nameEn)) : existing.slug;

  const { error: updateError } = await supabase
    .from("designs")
    .update({
      slug,
      category: parsed.category,
      name_en: parsed.nameEn,
      name_fr: parsed.nameFr?.trim() || null,
      price_cents: parsed.priceCents,
      description_en: parsed.descriptionEn?.trim() || null,
      description_fr: parsed.descriptionFr?.trim() || null,
      material_en: parsed.materialEn?.trim() || null,
      material_fr: parsed.materialFr?.trim() || null,
      dimensions: parsed.dimensions?.trim() || null,
      status: options.publish ? "active" : "draft",
    })
    .eq("id", id);
  if (updateError) throw updateError;

  for (const variant of parsed.variants) {
    const { data: inserted, error: variantError } = await supabase
      .from("variants")
      .insert({ design_id: id, label: variant.label, qty_on_hand: 0 })
      .select("id")
      .single();
    if (variantError) throw variantError;

    if (variant.qty > 0) {
      const { error: adjustError } = await supabase.rpc("adjust_inventory", {
        p_variant_id: inserted.id,
        p_delta: variant.qty,
        p_reason: "catalog",
        p_ref_id: id,
        p_note: "initial stock",
      });
      if (adjustError) throw adjustError;
    }
  }

  revalidatePath("/admin/catalog");
  return { slug };
}
