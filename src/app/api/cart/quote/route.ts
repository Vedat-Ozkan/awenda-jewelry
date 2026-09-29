import { NextResponse } from "next/server";
import { z } from "zod";
import { isLocale, type Locale } from "@/i18n/routing";
import { localize } from "@/lib/catalog/localize";
import { loadPricingData, type PublicDesignRow, type VariantJson } from "@/lib/cart/pricing";
import type { QuoteLine, QuoteResponse } from "@/lib/cart/types";

const quoteSchema = z.object({
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .max(50),
  fulfillment: z.enum(["pickup", "ship"]),
});

function buildQuoteLine(
  requested: { variantId: string; qty: number },
  match: { design: PublicDesignRow; variant: VariantJson } | undefined,
  locale: Locale,
): QuoteLine {
  if (!match || match.design.status !== "active") {
    const design = match?.design;
    return {
      variantId: requested.variantId,
      designSlug: design?.slug ?? "",
      name: design ? localize(design, locale).name : "",
      variantLabel: match?.variant.label ?? "",
      unitPriceCents: design?.price_cents ?? 0,
      qty: requested.qty,
      available: false,
      maxQty: 0,
      thumb: design?.thumb_image_path ?? null,
    };
  }

  const maxQty = Math.max(match.variant.qty_on_hand, 0);
  const available = maxQty > 0;
  return {
    variantId: requested.variantId,
    designSlug: match.design.slug!,
    name: localize(match.design, locale).name,
    variantLabel: match.variant.label,
    unitPriceCents: match.design.price_cents!,
    qty: available ? Math.min(requested.qty, maxQty) : requested.qty,
    available,
    maxQty,
    thumb: match.design.thumb_image_path,
  };
}

// Cart quote (Phase 5 step 6): re-prices every line server-side against
// public_designs/public_settings on every request. The client cart only
// ever stores { variantId, qty } in localStorage — never a price or an
// availability flag — so this is the only source of truth for what the
// customer sees on /[locale]/cart.
//
// `locale` comes in as a query param, not the request body: the phase
// file's body shape is `{ lines, fulfillment }` only, but line names still
// need to match the cart page's own locale, so the cart page appends
// `?locale=`. Settings are read straight from public_settings (uncached)
// rather than the cached lib/catalog getSettings() — a stale shipping
// toggle/rate here would misquote money, which the 60s catalog cache
// (unstable_cache, tag "catalog") isn't meant to guard against.
export async function POST(request: Request) {
  const localeParam = new URL(request.url).searchParams.get("locale");
  const locale: Locale = isLocale(localeParam ?? "") ? (localeParam as Locale) : "en";

  const body = await request.json().catch(() => null);
  const parsed = quoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { lines: requestedLines, fulfillment } = parsed.data;

  const { byVariant, settings: settingsRow } = await loadPricingData();

  const lines = requestedLines.map((requested) => buildQuoteLine(requested, byVariant.get(requested.variantId), locale));

  const subtotalCents = lines
    .filter((line) => line.available)
    .reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0);

  // No settings row (should not happen after migration 0007): treat as pickup-only.
  const shippingEnabled = settingsRow?.shipping_enabled ?? false;
  if (fulfillment === "ship" && !shippingEnabled) {
    return NextResponse.json({ error: "shipping_disabled" }, { status: 400 });
  }
  const freeShippingThresholdCents = settingsRow?.free_shipping_threshold_cents ?? null;
  const overThreshold = freeShippingThresholdCents != null && subtotalCents >= freeShippingThresholdCents;
  const shippingCents =
    fulfillment === "ship" ? (overThreshold ? 0 : (settingsRow?.shipping_flat_cents ?? 0)) : 0;

  const response: QuoteResponse = {
    lines,
    subtotalCents,
    shippingCents,
    shippingFlatCents: settingsRow?.shipping_flat_cents ?? null,
    freeShippingThresholdCents,
    totalCents: subtotalCents + shippingCents,
    shippingEnabled,
  };

  return NextResponse.json(response);
}
