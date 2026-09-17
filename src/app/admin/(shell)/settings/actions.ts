"use server";

import { revalidatePath } from "next/cache";
import { requireAdminFromCookies } from "@/lib/auth";
import { formatZodError, settingsSchema, type SettingsInput } from "@/lib/settings/schema";
import { createAdminClient } from "@/lib/supabase/admin";

// Settings page (Phase 4 step 9): the single `settings` row (id = 1),
// validated by settingsSchema (src/lib/settings/schema.ts — kept out of
// this "use server" file since every export here must be an async action).
export async function saveSettings(data: SettingsInput): Promise<void> {
  await requireAdminFromCookies();

  const parsed = settingsSchema.safeParse(data);
  if (!parsed.success) throw new Error(formatZodError(parsed.error));
  const value = parsed.data;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("settings")
    .update({
      market_name: value.marketName?.trim() || null,
      market_address: value.marketAddress?.trim() || null,
      market_weekday: value.marketWeekday,
      market_open_time: value.marketOpenTime,
      market_close_time: value.marketCloseTime,
      market_timezone: value.marketTimezone,
      market_closed_until: value.marketClosedUntil || null,
      market_closed_note_en: value.marketClosedNoteEn?.trim() || null,
      market_closed_note_fr: value.marketClosedNoteFr?.trim() || null,
      pickup_instructions_en: value.pickupInstructionsEn?.trim() || null,
      pickup_instructions_fr: value.pickupInstructionsFr?.trim() || null,
      shipping_enabled: value.shippingEnabled,
      shipping_flat_cents: value.shippingFlatCents,
      free_shipping_threshold_cents: value.freeShippingThresholdCents ?? null,
      stripe_tax_enabled: value.stripeTaxEnabled,
      variant_presets: value.variantPresets,
    })
    .eq("id", 1);
  if (error) throw error;

  revalidatePath("/admin/settings");
}
