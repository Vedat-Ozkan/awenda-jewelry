import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { isLocale } from "@/i18n/routing";
import { formatMarketDate } from "@/lib/catalog/format";
import { localize } from "@/lib/catalog/localize";
import { createAnonClient } from "@/lib/catalog/client";
import { loadPricingData } from "@/lib/cart/pricing";
import { buildCheckoutSessionParams, serializeCheckoutLinesMetadata } from "@/lib/checkout/build-session";
import { env } from "@/lib/env";
import { getStripeClient } from "@/lib/stripe";
import { resolvePhotoUrl } from "@/lib/supabase/storage";

const METADATA_LINES_MAX_CHARS = 500;

const checkoutSchema = z.object({
  lines: z
    .array(z.object({ variantId: z.string().min(1), qty: z.number().int().positive() }))
    .min(1)
    .max(50),
  fulfillment: z.enum(["pickup", "ship"]),
  locale: z.string().refine(isLocale),
});

function absoluteImageUrl(path: string, siteUrl: string): string {
  return path.startsWith("http") ? path : `${siteUrl}${path}`;
}

// Replaces the Phase 5 stub. Re-validates and re-prices every cart line
// against the DB (same source as /api/cart/quote — see
// src/lib/cart/pricing.ts), rejects anything unavailable, then builds and
// creates a Stripe Checkout Session. The client never supplies price or
// availability — only { variantId, qty }.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { fulfillment, locale } = parsed.data;

  // Sum quantities for a variant repeated across lines (e.g. two separate
  // "add to cart" calls before the cart page merged them) before validating
  // against qty_on_hand, so a split cart isn't rejected as unavailable when
  // the combined quantity is actually fine.
  const qtyByVariant = new Map<string, number>();
  for (const line of parsed.data.lines) {
    qtyByVariant.set(line.variantId, (qtyByVariant.get(line.variantId) ?? 0) + line.qty);
  }
  const requestedLines = [...qtyByVariant.entries()].map(([variantId, qty]) => ({ variantId, qty }));

  const { byVariant, settings: settingsRow } = await loadPricingData();

  const shippingEnabled = settingsRow?.shipping_enabled ?? false;
  if (fulfillment === "ship" && !shippingEnabled) {
    return NextResponse.json({ error: "shipping_disabled" }, { status: 400 });
  }

  const unavailable: { variantId: string; available: number }[] = [];
  for (const requested of requestedLines) {
    const match = byVariant.get(requested.variantId);
    if (!match || match.design.status !== "active" || requested.qty > match.variant.qty_on_hand) {
      unavailable.push({
        variantId: requested.variantId,
        available: match && match.design.status === "active" ? match.variant.qty_on_hand : 0,
      });
    }
  }
  if (unavailable.length > 0) {
    return NextResponse.json({ error: "unavailable", lines: unavailable }, { status: 400 });
  }

  const siteUrl = env.NEXT_PUBLIC_SITE_URL;
  const checkoutLines = requestedLines.map((requested) => {
    const match = byVariant.get(requested.variantId)!;
    const mainImagePath = match.design.main_image_path;
    return {
      variantId: requested.variantId,
      qty: requested.qty,
      name: localize(match.design, locale).name,
      variantLabel: match.variant.label,
      unitAmountCents: match.design.price_cents!,
      imageUrl: mainImagePath ? absoluteImageUrl(resolvePhotoUrl(mainImagePath)!, siteUrl) : null,
    };
  });

  if (serializeCheckoutLinesMetadata(checkoutLines).length > METADATA_LINES_MAX_CHARS) {
    return NextResponse.json({ error: "too_many_lines" }, { status: 400 });
  }

  let nextMarketDate: string | null = null;
  if (fulfillment === "pickup") {
    const supabase = createAnonClient();
    const { data, error } = await supabase.rpc("next_market_date");
    if (error) throw error;
    nextMarketDate = data;
  }

  // Translated copy (messages/{en,fr}.json "checkout") resolved here so
  // buildCheckoutSessionParams stays a pure function with no i18n of its own.
  const t = await getTranslations({ locale, namespace: "checkout" });
  const copy = {
    pickupMessage: nextMarketDate
      ? t("pickupMessage", { date: formatMarketDate(nextMarketDate, locale) })
      : t("pickupMessageNoDate"),
    shippingLabel: t("shippingFlat"),
    freeShippingLabel: t("shippingFree"),
  };

  const params = buildCheckoutSessionParams({
    lines: checkoutLines,
    fulfillment,
    locale,
    settings: {
      shippingFlatCents: settingsRow?.shipping_flat_cents ?? 0,
      freeShippingThresholdCents: settingsRow?.free_shipping_threshold_cents ?? null,
      stripeTaxEnabled: settingsRow?.stripe_tax_enabled ?? false,
    },
    siteUrl,
    copy,
  });

  const stripe = getStripeClient();
  const session = await stripe.checkout.sessions.create(params);

  return NextResponse.json({ url: session.url });
}
