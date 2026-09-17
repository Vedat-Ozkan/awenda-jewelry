import { z } from "zod";

// Category keys mirror the `category` enum (0002_core.sql) and the other
// CATEGORIES lists in the catalog admin (e.g. new/actions.ts) — duplicated
// rather than shared, matching that existing pattern.
const CATEGORIES = [
  "necklace",
  "bracelet",
  "anklet",
  "ring",
  "earring",
  "bangle",
  "chain",
  "pendant",
] as const;

// Settings page (Phase 4 step 9): `variant_presets` is a JSON textarea, so
// this must reject anything that isn't exactly the 8 category keys, each a
// non-empty array of non-empty labels — a missing category, a typo'd key,
// or an empty array all fail with a readable zod error.
export const variantPresetsSchema = z
  .object(
    Object.fromEntries(CATEGORIES.map((category) => [category, z.array(z.string().min(1)).min(1)])) as Record<
      (typeof CATEGORIES)[number],
      z.ZodArray<z.ZodString>
    >,
  )
  .strict();

// Plain HH:MM (settings.market_open_time/close_time are `time` columns).
const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM");

export const settingsSchema = z.object({
  marketName: z.string().optional(),
  marketAddress: z.string().optional(),
  marketWeekday: z.number().int().min(0).max(6),
  marketOpenTime: timeSchema,
  marketCloseTime: timeSchema,
  marketTimezone: z
    .string()
    .refine((tz) => Intl.supportedValuesOf("timeZone").includes(tz), { message: "Not a recognized IANA timezone" }),
  marketClosedUntil: z.string().nullable().optional(),
  marketClosedNoteEn: z.string().optional(),
  marketClosedNoteFr: z.string().optional(),
  pickupInstructionsEn: z.string().optional(),
  pickupInstructionsFr: z.string().optional(),
  shippingEnabled: z.boolean(),
  shippingFlatCents: z.number().int().min(0),
  freeShippingThresholdCents: z.number().int().min(0).nullable().optional(),
  stripeTaxEnabled: z.boolean(),
  variantPresets: variantPresetsSchema,
});

export type SettingsInput = z.input<typeof settingsSchema>;

// Turns a ZodError into one readable line per issue, e.g.
// "variantPresets.ring: Array must contain at least 1 element(s)".
export function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".") || "value"}: ${issue.message}`).join("; ");
}
