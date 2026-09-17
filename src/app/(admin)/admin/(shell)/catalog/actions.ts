"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { requireAdminFromCookies } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Bulk operations from the catalog list's selection bar (Phase 4 step 8).
// Archive/activate/set price are each a single `update ... where id = any()`
// — atomic by nature, no transaction needed. Restock goes through the
// bulk_restock() Postgres function (0006_bulk_ops.sql), which loops
// adjust_inventory() for every variant of the selected designs.
//
// revalidateTag("catalog", …) invalidates src/lib/catalog/index.ts's
// unstable_cache-wrapped storefront reads (Phase 5 step 2). Next 16's
// revalidateTag() now requires a second "profile" argument (see
// node_modules/next/dist/server/web/spec-extension/revalidate.d.ts) — it's
// only meaningful for `use cache`/cacheLife (which this app doesn't use;
// see next.config.ts), so "minutes" is just the closest label to our
// unstable_cache revalidate: 60 and has no effect on this classic-model tag.
const idsSchema = z.array(z.string().uuid()).min(1);

export async function archiveDesigns(ids: string[]): Promise<void> {
  await requireAdminFromCookies();
  const parsedIds = idsSchema.parse(ids);

  const supabase = createAdminClient();
  const { error } = await supabase.from("designs").update({ status: "archived" }).in("id", parsedIds);
  if (error) throw error;

  revalidatePath("/admin/catalog");
  revalidateTag("catalog", "minutes");
}

export async function activateDesigns(ids: string[]): Promise<void> {
  await requireAdminFromCookies();
  const parsedIds = idsSchema.parse(ids);

  const supabase = createAdminClient();
  const { error } = await supabase.from("designs").update({ status: "active" }).in("id", parsedIds);
  if (error) throw error;

  revalidatePath("/admin/catalog");
  revalidateTag("catalog", "minutes");
}

const priceCentsSchema = z.number().int().positive();

export async function setPriceForDesigns(ids: string[], priceCents: number): Promise<void> {
  await requireAdminFromCookies();
  const parsedIds = idsSchema.parse(ids);
  const parsedPrice = priceCentsSchema.parse(priceCents);

  const supabase = createAdminClient();
  const { error } = await supabase.from("designs").update({ price_cents: parsedPrice }).in("id", parsedIds);
  if (error) throw error;

  revalidatePath("/admin/catalog");
  revalidateTag("catalog", "minutes");
}

const restockQtySchema = z.number().int().positive();

export async function restockDesigns(ids: string[], qty: number, note?: string): Promise<void> {
  await requireAdminFromCookies();
  const parsedIds = idsSchema.parse(ids);
  const parsedQty = restockQtySchema.parse(qty);

  const supabase = createAdminClient();
  const { error } = await supabase.rpc("bulk_restock", {
    p_design_ids: parsedIds,
    p_qty: parsedQty,
    p_note: note,
  });
  if (error) throw error;

  revalidatePath("/admin/catalog");
  revalidateTag("catalog", "minutes");
}
