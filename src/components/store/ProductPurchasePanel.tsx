"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { Variant } from "@/lib/catalog";
import { Button } from "./Button";
import { LeadForm } from "./LeadForm";

// Product page variant picker + quantity stepper + Add to bag (Phase 5
// step 5, cart wiring in step 6; Silver Mist pills). Only reached when at
// least one variant is in stock — the page shows the sold-out panel instead
// when every variant is at 0. Sold-out variants stay selectable (the
// "— Sold out" label conveys the state) so choosing one swaps the purchase
// controls for the Phase 7 "notify me" form for that variant.
export function ProductPurchasePanel({ designId, variants }: { designId: string; variants: Variant[] }) {
  const t = useTranslations("product");
  const cart = useCart();
  const inStock = variants.filter((v) => v.qty_on_hand > 0);
  const [selectedId, setSelectedId] = useState(inStock[0]?.id);
  const selected = variants.find((v) => v.id === selectedId);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const max = selected?.qty_on_hand ?? 1;

  function selectVariant(id: string) {
    setSelectedId(id);
    setQty(1);
    setAdded(false);
  }

  function handleAdd() {
    if (!selected) return;
    cart.add(selected.id, qty, selected.qty_on_hand, designId);
    setAdded(true);
  }

  const stepper =
    "flex size-11 items-center justify-center rounded-full text-lg leading-none hover:bg-white disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="flex flex-col gap-5">
      {variants.length > 1 && (
        <fieldset>
          <legend className="mb-2.5 text-sm font-medium">{t("variant")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const soldOut = v.qty_on_hand <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  aria-pressed={v.id === selectedId}
                  onClick={() => selectVariant(v.id)}
                  className={`min-h-11 rounded-full px-5 text-sm font-medium transition-colors ${
                    v.id === selectedId ? "bg-ink text-white" : "bg-mist text-ink hover:bg-ink/10"
                  } ${soldOut && v.id !== selectedId ? "opacity-50" : ""}`}
                >
                  {v.label}
                  {soldOut ? ` — ${t("soldOut")}` : ""}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      {selected && selected.qty_on_hand <= 0 ? (
        <section id="notify-me">
          <LeadForm key={selected.id} kind="notify" designId={designId} variantId={selected.id} />
        </section>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="quantity" className="text-sm font-medium">
              {t("quantity")}
            </label>
            <div className="flex items-center rounded-full bg-mist p-0.5">
              <button
                type="button"
                aria-label={t("quantityDecrease")}
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className={stepper}
              >
                <span aria-hidden="true">−</span>
              </button>
              <input
                id="quantity"
                type="number"
                min={1}
                max={max}
                value={qty}
                onChange={(e) => {
                  const value = Number(e.target.value) || 1;
                  setQty(Math.min(Math.max(1, value), max));
                }}
                className="h-11 w-12 bg-transparent text-center text-base font-medium [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label={t("quantityIncrease")}
                disabled={qty >= max}
                onClick={() => setQty((q) => Math.min(max, q + 1))}
                className={stepper}
              >
                <span aria-hidden="true">+</span>
              </button>
            </div>
          </div>

          <Button
            type="button"
            variant="accent"
            size="lg"
            data-testid="add-to-cart"
            disabled={!selected}
            onClick={handleAdd}
            className="w-full"
          >
            {t("addToCart")}
          </Button>
          {added && (
            <p role="status" className="-mt-2 text-center text-sm font-medium text-accent">
              {t("added")}
            </p>
          )}
        </>
      )}
    </div>
  );
}
