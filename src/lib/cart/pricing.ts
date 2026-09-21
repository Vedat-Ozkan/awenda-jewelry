import { createAnonClient } from "@/lib/catalog/client";
import type { Database } from "@/lib/supabase/database.types";

// Shared by /api/cart/quote (Phase 5) and /api/checkout (Phase 6): both
// re-price every cart line against public_designs/public_settings on every
// request, using the anon client (RLS-readable, no service role needed) and
// maybeSingle() for the settings row. The client cart only ever stores
// { variantId, qty } — never a price or an availability flag.
export type PublicDesignRow = Database["public"]["Views"]["public_designs"]["Row"];
export type PublicSettingsRow = Database["public"]["Views"]["public_settings"]["Row"];

export interface VariantJson {
  id: string;
  label: string;
  qty_on_hand: number;
}

export interface VariantMatch {
  design: PublicDesignRow;
  variant: VariantJson;
}

export interface PricingData {
  byVariant: Map<string, VariantMatch>;
  settings: PublicSettingsRow | null;
}

export async function loadPricingData(): Promise<PricingData> {
  const supabase = createAnonClient();
  const [{ data: designs, error: designsError }, { data: settings, error: settingsError }] = await Promise.all([
    supabase.from("public_designs").select("*"),
    supabase.from("public_settings").select("*").maybeSingle(),
  ]);
  if (designsError) throw designsError;
  if (settingsError) throw settingsError;

  const byVariant = new Map<string, VariantMatch>();
  for (const design of designs ?? []) {
    const variants = (design.variants as unknown as VariantJson[]) ?? [];
    for (const variant of variants) {
      byVariant.set(variant.id, { design, variant });
    }
  }

  return { byVariant, settings: settings ?? null };
}
