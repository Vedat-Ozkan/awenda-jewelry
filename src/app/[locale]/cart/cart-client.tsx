"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/store/Button";
import { formatPrice } from "@/components/store/Price";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useCart } from "@/lib/cart/CartContext";
import type { Fulfillment, QuoteResponse } from "@/lib/cart/types";
import { resolvePhotoUrl } from "@/lib/supabase/storage";

// `/[locale]/cart` client (Phase 5 step 6). Re-quotes the localStorage cart
// against POST /api/cart/quote on every change (lines, fulfillment) — the
// client cart never carries a trustworthy price or availability flag.
export function CartClient({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState(false);
  const [quoteError, setQuoteError] = useState(false);

  useEffect(() => {
    // Nothing to quote — the empty-cart branch below renders instead and
    // never reads `quote`, so there's no need to reset it here.
    if (cart.lines.length === 0) return;
    let cancelled = false;
    fetch(`/api/cart/quote?locale=${locale}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lines: cart.lines, fulfillment }),
    })
      .then((res) => {
        if (!res.ok) throw new Error(`quote ${res.status}`);
        return res.json() as Promise<QuoteResponse>;
      })
      .then((data) => {
        if (!cancelled) {
          setQuoteError(false);
          setQuote(data);
        }
      })
      .catch(() => {
        if (!cancelled) setQuoteError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [cart.lines, fulfillment, locale]);

  async function handleCheckout() {
    setCheckoutError(false);
    const res = await fetch("/api/checkout", { method: "POST" });
    if (!res.ok) setCheckoutError(true);
  }

  if (cart.lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <p className="text-ink/70">{t("empty")}</p>
        <Link href="/" locale={locale} className="mt-4 inline-block underline">
          {t("backToShop")}
        </Link>
      </main>
    );
  }

  if (!quote) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
        <p className="text-sm text-ink/60">{quoteError ? t("loadError") : t("loading")}</p>
      </main>
    );
  }

  const hasUnavailable = quote.lines.some((line) => !line.available);

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:px-8">
      <h1 className="mb-6 font-serif text-3xl text-ink">{t("title")}</h1>

      <ul className="divide-y divide-ink/10">
        {quote.lines.map((line) => {
          const src = resolvePhotoUrl(line.thumb);
          return (
            <li key={line.variantId} className="flex items-center gap-4 py-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded bg-ivory">
                {src && <Image src={src} alt="" width={64} height={64} className="h-full w-full object-cover" />}
              </div>
              <div className="flex-1">
                {line.available ? (
                  <Link href={`/p/${line.designSlug}`} locale={locale} className="text-ink hover:underline">
                    {line.name}
                  </Link>
                ) : (
                  <p className="text-ink/50">{line.name || t("unavailableItem")}</p>
                )}
                {line.variantLabel && <p className="text-sm text-ink/60">{line.variantLabel}</p>}
                {!line.available && <p className="text-sm text-red-700">{t("unavailable")}</p>}
              </div>
              <p className="w-20 text-right text-sm text-ink">{formatPrice(line.unitPriceCents, locale)}</p>
              <input
                type="number"
                aria-label={t("quantity")}
                min={1}
                max={Math.max(line.maxQty, 1)}
                value={line.qty}
                disabled={!line.available}
                onChange={(e) => {
                  const value = Number(e.target.value) || 1;
                  cart.setQty(line.variantId, value, line.maxQty);
                }}
                className="w-16 rounded border border-ink/20 px-2 py-1 text-center disabled:opacity-40"
              />
              <button type="button" onClick={() => cart.remove(line.variantId)} className="text-sm text-ink/60 underline">
                {t("remove")}
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex justify-between text-ink">
        <span>{t("subtotal")}</span>
        <span data-testid="cart-subtotal">{formatPrice(quote.subtotalCents, locale)}</span>
      </div>

      <fieldset className="mt-6">
        <legend className="mb-2 text-sm text-ink/70">{t("fulfillment.label")}</legend>
        <label className="flex items-center gap-2">
          <input
            type="radio"
            name="fulfillment"
            checked={fulfillment === "pickup"}
            onChange={() => setFulfillment("pickup")}
          />
          {t("fulfillment.pickup")}
        </label>
        {quote.shippingEnabled && (
          <label className="mt-2 flex items-center gap-2">
            <input
              type="radio"
              name="fulfillment"
              checked={fulfillment === "ship"}
              onChange={() => setFulfillment("ship")}
            />
            {t("fulfillment.ship", { rate: formatPrice(quote.shippingFlatCents ?? 0, locale) })}
          </label>
        )}
      </fieldset>

      {quote.shippingEnabled && quote.freeShippingThresholdCents != null && (
        <p className="mt-2 text-sm text-ink/60">
          {quote.subtotalCents >= quote.freeShippingThresholdCents
            ? t("freeShipping.unlocked")
            : t("freeShipping.progress", {
                amount: formatPrice(quote.freeShippingThresholdCents - quote.subtotalCents, locale),
              })}
        </p>
      )}

      <div className="mt-4 flex justify-between text-lg font-medium text-ink">
        <span>{t("total")}</span>
        <span data-testid="cart-total">{formatPrice(quote.totalCents, locale)}</span>
      </div>

      {hasUnavailable && <p className="mt-2 text-sm text-red-700">{t("blockedByUnavailable")}</p>}
      {checkoutError && <p className="mt-2 text-sm text-red-700">{t("checkoutError")}</p>}

      <Button
        type="button"
        data-testid="checkout"
        disabled={hasUnavailable || quote.lines.length === 0}
        onClick={handleCheckout}
        className="mt-4"
      >
        {t("checkout")}
      </Button>
    </main>
  );
}
