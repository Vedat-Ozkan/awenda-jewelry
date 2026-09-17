import { getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import type { Settings } from "@/lib/catalog";
import { formatPrice } from "./Price";

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
    <ul className="mb-10 grid grid-cols-1 gap-3 text-center text-sm text-ink/70 sm:grid-cols-3">
      {items.map((item) => (
        <li key={item} className="rounded-lg border border-ink/10 px-4 py-3">
          {item}
        </li>
      ))}
    </ul>
  );
}
