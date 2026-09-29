"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button, buttonClasses } from "@/components/store/Button";
import { formatPrice } from "@/components/store/Price";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { track } from "@/lib/analytics/client";
import { useCart } from "@/lib/cart/CartContext";
import type { Fulfillment, QuoteResponse } from "@/lib/cart/types";
import { resolvePhotoUrl } from "@/lib/supabase/storage";

// `/[locale]/cart` client (Phase 5 step 6; Silver Mist cards). Re-quotes the localStorage cart
// against POST /api/cart/quote on every change (lines, fulfillment) — the
// client cart never carries a trustworthy price or availability flag.
export function CartClient({ locale }: { locale: Locale }) {
  const t = useTranslations("cart");
  const tProduct = useTranslations("product");
  const cart = useCart();
  const [fulfillment, setFulfillment] = useState<Fulfillment>("pickup");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [checkoutError, setCheckoutError] = useState<"unavailable" | "shipping_disabled" | "generic" | null>(null);
  const [checkoutUnavailableIds, setCheckoutUnavailableIds] = useState<Set<string>>(new Set());
  const [checkingOut, setCheckingOut] = useState(false);
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
          // A fresh quote reflects current server truth — drop any
          // unavailable marker a previous failed checkout attempt left on
          // lines that no longer exist in this quote (or since resolved).
          setCheckoutUnavailableIds(new Set());
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
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines: cart.lines.map(({ variantId, qty }) => ({ variantId, qty })),
          fulfillment,
          locale,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url: string };
        track("begin_checkout");
        window.location.assign(data.url);
        return; // keep the button disabled through the redirect
      }
      const body = (await res.json().catch(() => null)) as { error?: string; lines?: { variantId: string }[] } | null;
      if (body?.error === "unavailable" && Array.isArray(body.lines)) {
        setCheckoutUnavailableIds(new Set(body.lines.map((line) => line.variantId)));
        setCheckoutError("unavailable");
      } else if (body?.error === "shipping_disabled") {
        setFulfillment("pickup");
        setCheckoutError("shipping_disabled");
      } else {
        setCheckoutError("generic");
      }
    } catch {
      setCheckoutError("generic");
    } finally {
      setCheckingOut(false);
    }
  }

  const shell = "mx-auto w-full max-w-[1360px] px-3 pb-10 pt-6 md:px-10 lg:pb-20 lg:pt-10";
  const heading =
    "mb-5 px-1 font-serif text-[40px] leading-[1.05] font-normal tracking-[-0.02em] lg:mb-8 lg:px-0 lg:text-[56px]";

  if (cart.lines.length === 0) {
    return (
      <main className={shell}>
        <h1 className={heading}>{t("title")}</h1>
        <div className="flex flex-col items-center gap-5 rounded-3xl bg-white px-6 py-14 text-center">
          <p className="text-muted">{t("empty")}</p>
          <Link href="/" locale={locale} className={buttonClasses("primary", "lg")}>
            {t("backToShop")}
          </Link>
        </div>
      </main>
    );
  }

  if (!quote) {
    return (
      <main className={shell}>
        <h1 className={heading}>{t("title")}</h1>
        <p className="rounded-3xl bg-white px-6 py-10 text-center text-muted">
          {quoteError ? t("loadError") : t("loading")}
        </p>
      </main>
    );
  }

  const hasUnavailable = quote.lines.some((line) => !line.available || checkoutUnavailableIds.has(line.variantId));
  const threshold = quote.shippingEnabled ? quote.freeShippingThresholdCents : null;
  const choice =
    "relative flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-mist bg-white px-4 py-3 text-[15px] font-medium transition-colors has-[:checked]:border-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent";
  const dot =
    "size-5 shrink-0 rounded-full border-2 border-muted/50 peer-checked:border-ink peer-checked:bg-ink peer-checked:shadow-[inset_0_0_0_3px_white]";

  return (
    <main className={shell}>
      <h1 className={heading}>{t("title")}</h1>

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_420px] lg:items-start lg:gap-8">
        <ul className="flex flex-col gap-3">
          {quote.lines.map((line) => {
            const src = resolvePhotoUrl(line.thumb);
            const unavailable = !line.available || checkoutUnavailableIds.has(line.variantId);
            return (
              <li key={line.variantId} className="flex gap-3.5 rounded-[20px] bg-white p-3 lg:gap-5 lg:p-4">
                <div className="relative size-[88px] shrink-0 overflow-hidden rounded-2xl bg-well lg:size-[104px]">
                  {src && <Image src={src} alt="" fill sizes="104px" className="object-cover" />}
                </div>
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {unavailable ? (
                        <p className="font-medium text-muted">{line.name || t("unavailableItem")}</p>
                      ) : (
                        <Link
                          href={`/p/${line.designSlug}`}
                          locale={locale}
                          className="font-medium hover:text-accent"
                        >
                          {line.name}
                        </Link>
                      )}
                      {line.variantLabel && <p className="text-sm text-muted">{line.variantLabel}</p>}
                      {unavailable && <p className="text-sm text-red-700">{t("unavailable")}</p>}
                    </div>
                    <p className="shrink-0 font-medium">{formatPrice(line.unitPriceCents, locale)}</p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div className={`flex items-center rounded-full bg-mist p-0.5 ${unavailable ? "opacity-40" : ""}`}>
                      <button
                        type="button"
                        aria-label={tProduct("quantityDecrease")}
                        disabled={unavailable || line.qty <= 1}
                        onClick={() => cart.setQty(line.variantId, line.qty - 1, line.maxQty)}
                        className="flex size-11 items-center justify-center rounded-full text-lg leading-none hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <span aria-hidden="true">−</span>
                      </button>
                      <input
                        type="number"
                        aria-label={t("quantity")}
                        min={1}
                        max={Math.max(line.maxQty, 1)}
                        value={line.qty}
                        disabled={unavailable}
                        onChange={(e) => {
                          const value = Number(e.target.value) || 1;
                          cart.setQty(line.variantId, value, line.maxQty);
                        }}
                        className="h-11 w-10 bg-transparent text-center font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label={tProduct("quantityIncrease")}
                        disabled={unavailable || line.qty >= line.maxQty}
                        onClick={() => cart.setQty(line.variantId, line.qty + 1, line.maxQty)}
                        className="flex size-11 items-center justify-center rounded-full text-lg leading-none hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent"
                      >
                        <span aria-hidden="true">+</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => cart.remove(line.variantId)}
                      className="flex h-11 items-center px-2 text-sm font-medium text-muted underline underline-offset-4 hover:text-ink"
                    >
                      {t("remove")}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <section className="flex flex-col gap-5 rounded-3xl bg-white p-5 lg:sticky lg:top-6 lg:rounded-[28px] lg:p-7">
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm font-medium">{t("fulfillment.label")}</legend>
            <label className={choice}>
              <input
                type="radio"
                name="fulfillment"
                checked={fulfillment === "pickup"}
                onChange={() => setFulfillment("pickup")}
                className="peer absolute inset-0 size-full cursor-pointer opacity-0"
              />
              <span aria-hidden="true" className={dot} />
              {t("fulfillment.pickup")}
            </label>
            {quote.shippingEnabled && (
              <label className={choice}>
                <input
                  type="radio"
                  name="fulfillment"
                  checked={fulfillment === "ship"}
                  onChange={() => setFulfillment("ship")}
                  className="peer absolute inset-0 size-full cursor-pointer opacity-0"
                />
                <span aria-hidden="true" className={dot} />
                {t("fulfillment.ship", { rate: formatPrice(quote.shippingFlatCents ?? 0, locale) })}
              </label>
            )}
          </fieldset>

          {threshold != null && (
            <div className="flex flex-col gap-2">
              <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-mist">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.min(100, Math.round((quote.subtotalCents / threshold) * 100))}%` }}
                />
              </div>
              <p className="text-sm text-muted">
                {quote.subtotalCents >= threshold
                  ? t("freeShipping.unlocked")
                  : t("freeShipping.progress", { amount: formatPrice(threshold - quote.subtotalCents, locale) })}
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2 border-t border-ink/10 pt-5">
            <div className="flex justify-between">
              <span className="text-muted">{t("subtotal")}</span>
              <span data-testid="cart-subtotal">{formatPrice(quote.subtotalCents, locale)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold">
              <span>{t("total")}</span>
              <span data-testid="cart-total">{formatPrice(quote.totalCents, locale)}</span>
            </div>
          </div>

          {hasUnavailable && <p className="text-sm text-red-700">{t("blockedByUnavailable")}</p>}
          {checkoutError === "shipping_disabled" && <p className="text-sm text-red-700">{t("shippingDisabled")}</p>}
          {checkoutError === "generic" && <p className="text-sm text-red-700">{t("checkoutError")}</p>}

          <Button
            type="button"
            variant="accent"
            size="lg"
            data-testid="checkout"
            disabled={hasUnavailable || quote.lines.length === 0 || checkingOut}
            onClick={handleCheckout}
            className="w-full"
          >
            {checkingOut ? t("checkingOut") : t("checkout")}
          </Button>
        </section>
      </div>
    </main>
  );
}
