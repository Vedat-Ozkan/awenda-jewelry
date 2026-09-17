"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { useCart } from "@/lib/cart/CartContext";
import type { Variant } from "@/lib/catalog";
import { Button } from "./Button";

// Product page variant picker + quantity stepper + Add to cart (Phase 5
// step 5, cart wiring in step 6). Only reached when at least one variant is
// in stock — the page shows the sold-out panel instead when every variant
// is at 0.
export function ProductPurchasePanel({ variants }: { variants: Variant[] }) {
  const t = useTranslations("product");
  const cart = useCart();
  const inStock = variants.filter((v) => v.qty_on_hand > 0);
  const [selectedId, setSelectedId] = useState(inStock[0]?.id);
  const selected = variants.find((v) => v.id === selectedId);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  function selectVariant(id: string) {
    setSelectedId(id);
    setQty(1);
    setAdded(false);
  }

  function handleAdd() {
    if (!selected) return;
    cart.add(selected.id, qty, selected.qty_on_hand);
    setAdded(true);
  }

  return (
    <div>
      {variants.length > 1 && (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm text-ink/70">{t("variant")}</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => {
              const soldOut = v.qty_on_hand <= 0;
              return (
                <button
                  key={v.id}
                  type="button"
                  disabled={soldOut}
                  aria-pressed={v.id === selectedId}
                  onClick={() => selectVariant(v.id)}
                  className={`rounded-full border border-gold px-3 py-1 text-sm transition-colors ${
                    v.id === selectedId ? "bg-gold text-ivory" : "text-ink"
                  } ${soldOut ? "cursor-not-allowed opacity-40" : "hover:bg-gold/10"}`}
                >
                  {v.label}
                  {soldOut ? ` — ${t("soldOut")}` : ""}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label htmlFor="quantity" className="text-sm text-ink/70">
          {t("quantity")}
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={selected?.qty_on_hand ?? 1}
          value={qty}
          onChange={(e) => {
            const max = selected?.qty_on_hand ?? 1;
            const value = Number(e.target.value) || 1;
            setQty(Math.min(Math.max(1, value), max));
          }}
          className="w-16 rounded border border-ink/20 px-2 py-1"
        />
      </div>

      <Button type="button" data-testid="add-to-cart" disabled={!selected} onClick={handleAdd}>
        {t("addToCart")}
      </Button>
      {added && (
        <p role="status" className="mt-2 text-sm text-gold">
          {t("added")}
        </p>
      )}
    </div>
  );
}
