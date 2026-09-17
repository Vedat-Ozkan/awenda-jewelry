"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdminFromCookies } from "@/lib/auth";
import { slugify } from "@/lib/catalog/slug";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

type Category = Database["public"]["Enums"]["category"];
type DesignStatus = Database["public"]["Enums"]["design_status"];

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
const STATUSES: [DesignStatus, ...DesignStatus[]] = ["draft", "active", "archived"];

const updateDesignSchema = z.object({
  slug: z.string().min(1),
  category: z.enum(CATEGORIES),
  nameEn: z.string().min(1),
  nameFr: z.string().optional(),
  descriptionEn: z.string().optional(),
  descriptionFr: z.string().optional(),
  materialEn: z.string().optional(),
  materialFr: z.string().optional(),
  dimensions: z.string().optional(),
  priceCents: z.number().int().positive(),
  status: z.enum(STATUSES),
});

type UpdateDesignInput = z.input<typeof updateDesignSchema>;

// Edit design (Phase 4 step 5): updates every field, including slug. On a
// slug change, the new slug must be free (checked against `designs`, same
// as uniqueSlug() in src/lib/catalog/slug.ts) and the old slug is appended
// to previous_slugs (migration 0005_design_specs.sql) for Phase 5's 301s.
export async function updateDesign(id: string, data: UpdateDesignInput): Promise<{ slug: string }> {
  await requireAdminFromCookies();
  z.string().uuid().parse(id);
  const parsed = updateDesignSchema.parse(data);
  const supabase = createAdminClient();

  const { data: existing, error: fetchError } = await supabase
    .from("designs")
    .select("slug, previous_slugs")
    .eq("id", id)
    .single();
  if (fetchError) throw fetchError;

  const newSlug = slugify(parsed.slug);
  if (!newSlug) throw new Error("Slug cannot be empty");

  let previousSlugs = existing.previous_slugs;
  if (newSlug !== existing.slug) {
    const { data: conflict, error: conflictError } = await supabase
      .from("designs")
      .select("id")
      .eq("slug", newSlug)
      .neq("id", id)
      .maybeSingle();
    if (conflictError) throw conflictError;
    if (conflict) throw new Error("Slug already in use");

    previousSlugs = [...existing.previous_slugs, existing.slug];
  }

  const { error: updateError } = await supabase
    .from("designs")
    .update({
      slug: newSlug,
      previous_slugs: previousSlugs,
      category: parsed.category,
      name_en: parsed.nameEn,
      name_fr: parsed.nameFr?.trim() || null,
      description_en: parsed.descriptionEn?.trim() || null,
      description_fr: parsed.descriptionFr?.trim() || null,
      material_en: parsed.materialEn?.trim() || null,
      material_fr: parsed.materialFr?.trim() || null,
      dimensions: parsed.dimensions?.trim() || null,
      price_cents: parsed.priceCents,
      status: parsed.status,
    })
    .eq("id", id);
  if (updateError) throw updateError;

  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath("/admin/catalog");
  return { slug: newSlug };
}

// Danger zone (Phase 4 step 5): archive without touching any other field —
// no hard delete.
export async function archiveDesign(id: string): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(id);
  const supabase = createAdminClient();

  const { error } = await supabase.from("designs").update({ status: "archived" }).eq("id", id);
  if (error) throw error;

  revalidatePath(`/admin/catalog/${id}`);
  revalidatePath("/admin/catalog");
}

// Variants: add a label at qty 0 (stock is added afterwards via a restock,
// which goes through adjust_inventory and so always leaves a ledger entry).
export async function addVariant(designId: string, label: string): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(designId);
  const parsedLabel = z.string().min(1).parse(label);
  const supabase = createAdminClient();

  const { count, error: countError } = await supabase
    .from("variants")
    .select("id", { count: "exact", head: true })
    .eq("design_id", designId);
  if (countError) throw countError;

  const { error } = await supabase
    .from("variants")
    .insert({ design_id: designId, label: parsedLabel, qty_on_hand: 0, sort_order: count ?? 0 });
  if (error) throw error;

  revalidatePath(`/admin/catalog/${designId}`);
}

// Variants: remove, but only if it carries no stock and no order has ever
// referenced it — otherwise report why, rather than letting the delete fail
// on the order_items foreign key (or silently discarding stock).
export async function removeVariant(designId: string, variantId: string): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(designId);
  z.string().uuid().parse(variantId);
  const supabase = createAdminClient();

  const { data: variant, error: variantError } = await supabase
    .from("variants")
    .select("qty_on_hand")
    .eq("id", variantId)
    .single();
  if (variantError) throw variantError;
  if (variant.qty_on_hand > 0) throw new Error("Cannot remove a variant that still has stock on hand");

  const { data: orderItem, error: orderItemError } = await supabase
    .from("order_items")
    .select("id")
    .eq("variant_id", variantId)
    .maybeSingle();
  if (orderItemError) throw orderItemError;
  if (orderItem) throw new Error("Cannot remove a variant referenced by an existing order");

  // inventory_movements.variant_id has no ON DELETE cascade (0002_core.sql);
  // qty_on_hand is 0, so this is history that nets to zero, not live stock.
  const { error: movementsError } = await supabase.from("inventory_movements").delete().eq("variant_id", variantId);
  if (movementsError) throw movementsError;

  const { error: deleteError } = await supabase.from("variants").delete().eq("id", variantId);
  if (deleteError) throw deleteError;

  revalidatePath(`/admin/catalog/${designId}`);
}

const adjustSchema = z
  .object({
    variantId: z.string().uuid(),
    delta: z.number().int().refine((d) => d !== 0, "Delta cannot be zero"),
    reason: z.enum(["restock", "adjustment"]),
    note: z.string().optional(),
  })
  .refine((v) => (v.reason === "restock" ? v.delta > 0 : v.delta < 0), {
    message: "restock requires a positive delta, adjustment requires a negative delta",
  });

// Variants: the only way quantity changes on the edit page — always through
// adjust_inventory() (0003_functions.sql / guard_qty_on_hand trigger), never
// a direct update. Raises 'insufficient_stock' if an adjustment would take
// qty_on_hand below zero.
export async function adjustVariantQty(
  designId: string,
  variantId: string,
  delta: number,
  reason: "restock" | "adjustment",
  note?: string,
): Promise<void> {
  await requireAdminFromCookies();
  const parsed = adjustSchema.parse({ variantId, delta, reason, note });
  const supabase = createAdminClient();

  const { error } = await supabase.rpc("adjust_inventory", {
    p_variant_id: parsed.variantId,
    p_delta: parsed.delta,
    p_reason: parsed.reason,
    p_ref_id: designId,
    p_note: parsed.note?.trim() || undefined,
  });
  if (error) throw error;

  revalidatePath(`/admin/catalog/${designId}`);
}

const MAX_FILE_BYTES = 5 * 1024 * 1024;

// Extra photos (display-only, no embedding — Phase 4 step 5). A dedicated
// server action rather than extending /api/photos: that route always embeds
// its target, so folding in a third, non-embedding target would conflate
// two different concerns in one file. Blobs already resized client-side
// (src/lib/images/resize.ts), same as the main-photo upload.
export async function addExtraPhoto(designId: string, formData: FormData): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(designId);

  const main = formData.get("main");
  const thumb = formData.get("thumb");
  if (!(main instanceof Blob) || !(thumb instanceof Blob)) throw new Error("main and thumb are required");
  if (main.size > MAX_FILE_BYTES || thumb.size > MAX_FILE_BYTES) throw new Error("Files must be 5 MB or smaller");

  const supabase = createAdminClient();

  const { count, error: countError } = await supabase
    .from("design_images")
    .select("id", { count: "exact", head: true })
    .eq("design_id", designId);
  if (countError) throw countError;
  const sortOrder = count ?? 0;

  const suffix = `${sortOrder}-${randomBytes(3).toString("hex")}`;
  const mainPath = `designs/${designId}/extra/${suffix}-main.jpg`;
  const thumbPath = `designs/${designId}/extra/${suffix}-thumb.jpg`;

  const uploadOptions = { upsert: false, cacheControl: "31536000", contentType: "image/jpeg" };
  const [mainUpload, thumbUpload] = await Promise.all([
    supabase.storage.from("photos").upload(mainPath, main, uploadOptions),
    supabase.storage.from("photos").upload(thumbPath, thumb, uploadOptions),
  ]);
  if (mainUpload.error) throw mainUpload.error;
  if (thumbUpload.error) throw thumbUpload.error;

  const { error: insertError } = await supabase
    .from("design_images")
    .insert({ design_id: designId, main_image_path: mainPath, thumb_image_path: thumbPath, sort_order: sortOrder });
  if (insertError) throw insertError;

  revalidatePath(`/admin/catalog/${designId}`);
}

export async function removeExtraPhoto(designId: string, imageId: string): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(designId);
  z.string().uuid().parse(imageId);
  const supabase = createAdminClient();

  const { data: image, error: imageError } = await supabase
    .from("design_images")
    .select("main_image_path, thumb_image_path")
    .eq("id", imageId)
    .single();
  if (imageError) throw imageError;

  const { error: removeError } = await supabase.storage
    .from("photos")
    .remove([image.main_image_path, image.thumb_image_path]);
  if (removeError) throw removeError;

  const { error: deleteError } = await supabase.from("design_images").delete().eq("id", imageId);
  if (deleteError) throw deleteError;

  revalidatePath(`/admin/catalog/${designId}`);
}

// Swaps sort_order with the neighbouring extra photo in the requested
// direction; a no-op at either end of the list.
export async function reorderExtraPhoto(designId: string, imageId: string, direction: "up" | "down"): Promise<void> {
  await requireAdminFromCookies();
  z.string().uuid().parse(designId);
  z.string().uuid().parse(imageId);
  const supabase = createAdminClient();

  const { data: images, error: imagesError } = await supabase
    .from("design_images")
    .select("id, sort_order")
    .eq("design_id", designId)
    .order("sort_order");
  if (imagesError) throw imagesError;

  const index = images.findIndex((img) => img.id === imageId);
  if (index === -1) throw new Error("Photo not found");
  const swapIndex = direction === "up" ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= images.length) return;

  const current = images[index];
  const swapWith = images[swapIndex];

  const { error: firstError } = await supabase
    .from("design_images")
    .update({ sort_order: swapWith.sort_order })
    .eq("id", current.id);
  if (firstError) throw firstError;

  const { error: secondError } = await supabase
    .from("design_images")
    .update({ sort_order: current.sort_order })
    .eq("id", swapWith.id);
  if (secondError) throw secondError;

  revalidatePath(`/admin/catalog/${designId}`);
}
