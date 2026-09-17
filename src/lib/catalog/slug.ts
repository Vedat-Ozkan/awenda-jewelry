import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// NFD-decompose so accents become separate combining marks, strip those
// marks, lower-case, then collapse anything non-alphanumeric into a single
// hyphen and trim leading/trailing hyphens. "Collier Été" -> "collier-ete".
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Appends a short random suffix to `base` until it's not already used by a
// design's current slug. Checked against `designs`, not `previous_slugs` —
// a slug that was previously used but has since moved on is free to reuse.
export async function uniqueSlug(base: string): Promise<string> {
  const supabase = createAdminClient();
  let slug = base;

  while (true) {
    const { data, error } = await supabase
      .from("designs")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) return slug;

    slug = `${base}-${randomBytes(3).toString("hex")}`;
  }
}
