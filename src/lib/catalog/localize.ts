import type { Locale } from "@/i18n/routing";

// DECISIONS.md "French product copy": name_fr/description_fr/material_fr are
// optional and fall back to the English field when absent or on the `en`
// locale. Pure function — no I/O — so it's unit-testable on its own.
export interface LocalizableRow {
  // Nullable to match `public_designs` (a view, so Postgres can't carry over
  // the base table's `not null`); name_en is never actually null in
  // practice, but the fallback below keeps this safe either way.
  name_en: string | null;
  name_fr: string | null;
  description_en: string | null;
  description_fr: string | null;
  material_en: string | null;
  material_fr: string | null;
}

export interface Localized {
  name: string;
  description: string | null;
  material: string | null;
}

export function localize(row: LocalizableRow, locale: Locale): Localized {
  const fr = locale === "fr";
  return {
    name: (fr && row.name_fr) || row.name_en || "",
    description: (fr ? row.description_fr : null) ?? row.description_en,
    material: (fr ? row.material_fr : null) ?? row.material_en,
  };
}
