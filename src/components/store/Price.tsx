import type { Locale } from "@/i18n/routing";

const FORMATTERS: Record<Locale, Intl.NumberFormat> = {
  en: new Intl.NumberFormat("en-CA", { style: "currency", currency: "CAD" }),
  fr: new Intl.NumberFormat("fr-CA", { style: "currency", currency: "CAD" }),
};

// Exported so non-JSX copy (trust strip/trust row sentences, Phase 5 steps
// 4/5) can format a price into a translated string without duplicating the
// formatter map.
export function formatPrice(cents: number, locale: Locale): string {
  return FORMATTERS[locale].format(cents / 100);
}

// CAD price, `en-CA`/`fr-CA` formatting — DECISIONS.md "Country and
// currency: Canada, CAD".
export function Price({ cents, locale }: { cents: number; locale: Locale }) {
  return <span>{formatPrice(cents, locale)}</span>;
}
