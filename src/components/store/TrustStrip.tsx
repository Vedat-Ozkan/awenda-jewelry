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

// Tile icon paths from the Silver Mist canvas (24px grid, accent stroke).
const TILE_ICONS = {
  pickup: "M12 21s-7-6.1-7-11a7 7 0 0 1 14 0c0 4.9-7 11-7 11zM12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  shipping: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM17 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  handmade: "M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18",
  material: "M12 3l8 4v6c0 4-3.5 7-8 8-4.5-1-8-4-8-8V7z",
  checkout: "M6 11V8a6 6 0 0 1 12 0v3M5 11h14v10H5z",
} as const;

// Home-page trust tiles (Silver Mist): pickup, shipping (or "made by hand"
// when shipping is turned off in settings), material, checkout. Copy makes no
// durability claims (DECISIONS.md "Visual redesign"). 2 columns on phones and
// tablets, 4 from lg; icons only from lg, as on the phone canvas.
export async function TrustStrip({ locale, settings }: { locale: Locale; settings: Settings }) {
  const t = await getTranslations("home.trust");

  const shippingTile = settings.shippingEnabled
    ? {
        icon: TILE_ICONS.shipping,
        title: t("shipping.title"),
        body:
          settings.freeShippingThresholdCents != null
            ? t("shipping.bodyFree", {
                threshold: formatPrice(settings.freeShippingThresholdCents, locale),
              })
            : t("shipping.body"),
      }
    : {
        icon: TILE_ICONS.handmade,
        title: t("handmade.title"),
        body: t("handmade.body"),
      };

  const tiles = [
    {
      icon: TILE_ICONS.pickup,
      title: t("pickup.title"),
      body: t("pickup.body"),
    },
    shippingTile,
    {
      icon: TILE_ICONS.material,
      title: t("material.title"),
      body: t("material.body"),
    },
    {
      icon: TILE_ICONS.checkout,
      title: t("checkout.title"),
      body: t("checkout.body"),
    },
  ];

  return (
    <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 lg:gap-4">
      {tiles.map((tile) => (
        <li
          key={tile.title}
          className="flex flex-col gap-1.5 rounded-[18px] bg-mist p-4 lg:gap-2 lg:rounded-[20px] lg:p-6"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            width="26"
            height="26"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="hidden text-accent lg:block"
          >
            <path d={tile.icon} />
          </svg>
          <span className="text-sm font-semibold lg:text-base">{tile.title}</span>
          <span className="text-[13px] leading-snug text-muted lg:text-sm lg:leading-normal">{tile.body}</span>
        </li>
      ))}
    </ul>
  );
}
