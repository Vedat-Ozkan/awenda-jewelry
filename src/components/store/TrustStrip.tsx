import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { Settings } from "@/lib/catalog";
import { formatPrice } from "./Price";

// Simple inline 24px line icons for the trust strip (Storefront light pass).
// Exported so the product page's own trust row (Phase 5 step 5) can reuse
// the same icons rather than duplicating the markup.
export function ShippingIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <rect x="1" y="7" width="13" height="10" rx="1" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="6" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

export function PickupIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M12 21s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

export function HandmadeIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0"
    >
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </svg>
  );
}

const ICONS = [ShippingIcon, PickupIcon, HandmadeIcon];

// Home-page trust strip (Phase 5 step 4, DECISIONS.md "Storefront design
// references" — Luzzo's hero -> trust strip structure): 3 items, the first
// driven by the shipping settings, the other two static.
export async function TrustStrip({ locale, settings }: { locale: Locale; settings: Settings }) {
  const t = await getTranslations("home.trust");

  let shippingItem: string;
  if (!settings.shippingEnabled) {
    shippingItem = t("pickupOnly");
  } else if (settings.freeShippingThresholdCents != null) {
    shippingItem = t("shipping", { threshold: formatPrice(settings.freeShippingThresholdCents, locale) });
  } else {
    shippingItem = t("shippingFlat");
  }

  const items = [shippingItem, t("pickup", { market: settings.marketName ?? "" }), t("handmade")];

  return (
    <ul className="mb-10 grid grid-cols-1 gap-6 border-y border-gold-muted py-6 text-center text-sm text-ink/70 sm:grid-cols-3">
      {items.map((item, i) => {
        const Icon = ICONS[i];
        return (
          <li key={item} className="flex flex-col items-center gap-2">
            <Icon />
            {item}
          </li>
        );
      })}
    </ul>
  );
}
