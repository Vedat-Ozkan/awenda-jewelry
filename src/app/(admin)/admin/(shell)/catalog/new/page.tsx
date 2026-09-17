import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { NewDesignClient } from "./new-design-client";

type Category = Database["public"]["Enums"]["category"];
type VariantPresets = Partial<Record<Category, string[]>>;

// Server component so the variant chip presets come from settings (RLS,
// admin-only) without a client round trip.
export default async function NewDesignPage() {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("settings")
    .select("variant_presets")
    .eq("id", 1)
    .single();
  if (error) throw error;

  return <NewDesignClient variantPresets={(settings.variant_presets ?? {}) as VariantPresets} />;
}
