import type { Database } from "@/lib/supabase/database.types";
import type { Supabase } from "./common";

export type PendingDesign = Pick<
  Database["public"]["Tables"]["designs"]["Row"],
  "id" | "slug" | "name_en" | "category" | "metal" | "main_image_path" | "thumb_image_path"
>;

// A design is pending when it has no AI photos yet, isn't archived, and its
// main photo is a real Storage upload (not a `seed/` placeholder SVG).
// Oldest first, so a `--limit` batch works through the backlog in order.
export async function findPendingDesigns(supabase: Supabase, limit?: number): Promise<PendingDesign[]> {
  let query = supabase
    .from("designs")
    .select("id, slug, name_en, category, metal, main_image_path, thumb_image_path")
    .is("ai_photos_at", null)
    .neq("status", "archived")
    .not("main_image_path", "is", null)
    .not("main_image_path", "like", "seed/%")
    .order("created_at")
    .order("id");
  if (limit !== undefined) query = query.limit(limit);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
